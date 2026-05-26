"""
Scraping service - gerencia jobs e orquestra scrapers.
"""
import asyncio
import traceback
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.scraping_job import ScrapingJob, JobStatus
from app.services.lead_service import LeadService
from app.core.database import AsyncSessionLocal
from app.core.config import settings
from loguru import logger


# Rastreia jobs: job_id -> True (rodando) / False (cancelado)
running_jobs: dict = {}


class ScrapingService:

    @staticmethod
    async def create_job(
        db: AsyncSession,
        query: str,
        max_results: int = 100,
        user_id: Optional[str] = None,
        only_with_phone: bool = False,
        only_with_email: bool = False,
    ) -> ScrapingJob:
        from app.scraper.utils import parse_query_location
        loc = parse_query_location(query)

        job = ScrapingJob(
            query=query,
            nicho=loc.get("nicho"),
            cidade=loc.get("cidade"),
            estado=loc.get("estado"),
            max_results=max_results,
            user_id=user_id,
            config={
                "only_with_phone": only_with_phone,
                "only_with_email": only_with_email,
            },
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        logger.info(f"Job criado: {job.id} - '{query}'")
        return job

    @staticmethod
    async def run_job(job_id: str):
        """Executa job de scraping em background (FastAPI BackgroundTasks)."""
        async with AsyncSessionLocal() as db:
            job = await ScrapingService._get_job(db, job_id)
            if not job:
                logger.error(f"Job {job_id} nao encontrado")
                return

            # Guarda started_at como variavel local para nao depender do ORM
            started_at = datetime.utcnow()

            job.status = JobStatus.executando
            job.started_at = started_at
            job.logs = f"[{started_at.strftime('%H:%M:%S')}] Job iniciado\n"
            await db.commit()

            running_jobs[str(job_id)] = True
            logger.info(f"Iniciando scraping: '{job.query}' (max: {job.max_results})")

            try:
                await ScrapingService._execute_scraping(db, job, started_at)

            except asyncio.CancelledError:
                job.status = JobStatus.cancelado
                job.logs = (job.logs or "") + f"[{datetime.utcnow().strftime('%H:%M:%S')}] Cancelado\n"
                await db.commit()

            except Exception as e:
                full_tb = traceback.format_exc()
                # Gera mensagem legivel mesmo para excecoes sem mensagem
                err_msg = f"{type(e).__name__}"
                if str(e):
                    err_msg += f": {str(e)}"

                logger.error(f"Job {job_id} falhou!\n{full_tb}")

                try:
                    job.status = JobStatus.erro
                    job.error_message = err_msg[:500]
                    job.finished_at = datetime.utcnow()
                    job.logs = (job.logs or "") + f"[{datetime.utcnow().strftime('%H:%M:%S')}] ERRO: {err_msg}\n"
                    job.logs = (job.logs or "") + f"Detalhes: {full_tb[-300:]}\n"
                    await db.commit()
                except Exception as commit_err:
                    logger.error(f"Erro ao salvar status de erro: {commit_err}")

            finally:
                running_jobs.pop(str(job_id), None)

    @staticmethod
    async def _execute_scraping(db: AsyncSession, job: ScrapingJob, started_at: datetime):
        """Executa o scraping em si: Maps + enriquecimento de sites."""
        job_id = str(job.id)

        # Filtros de qualidade configurados ao criar o job
        cfg = job.config or {}
        only_with_phone = cfg.get("only_with_phone", False)
        only_with_email = cfg.get("only_with_email", False)

        def log(msg: str):
            ts = datetime.utcnow().strftime('%H:%M:%S')
            job.logs = (job.logs or "") + f"[{ts}] {msg}\n"

        filtros_ativos = []
        if only_with_phone:
            filtros_ativos.append("telefone")
        if only_with_email:
            filtros_ativos.append("email")

        log(f"Buscando: '{job.query}' (max: {job.max_results})"
            + (f" | Filtro: apenas com {' + '.join(filtros_ativos)}" if filtros_ativos else ""))
        await db.commit()

        # ─── FASE 1: Google Maps via SerpAPI ─────────────────────────────
        log("Fase 1: Coletando Google Maps via SerpAPI...")
        await db.commit()

        # Carrega place_ids já no banco para evitar créditos desnecessários
        from app.models.lead import Lead as LeadModel
        from sqlalchemy import and_ as sql_and
        known_result = await db.execute(
            select(LeadModel.place_id).where(LeadModel.place_id.isnot(None))
        )
        known_place_ids = {row[0] for row in known_result.all()}

        # Leads já com email: não precisam de website visit
        enriched_result = await db.execute(
            select(LeadModel.place_id).where(
                sql_and(LeadModel.place_id.isnot(None), LeadModel.has_email == True)
            )
        )
        enriched_place_ids = {row[0] for row in enriched_result.all()}

        if known_place_ids:
            log(f"Dedup: {len(known_place_ids)} leads ja no banco ({len(enriched_place_ids)} com email)")

        maps_results: List[Dict[str, Any]] = []

        async def maps_progress(scraped: int, total: int, current_name: str = ""):
            """Callback de progresso — roda no mesmo event loop."""
            job.progress = int((scraped / max(total, 1)) * 50)
            job.total_found = total
            job.total_scraped = scraped
            if scraped % 5 == 0 or scraped == total:
                try:
                    await db.commit()
                except Exception:
                    pass

        from app.scraper.serp_maps import SerpApiMapsScraper
        scraper = SerpApiMapsScraper()
        maps_results = await scraper.scrape_query(
            query=job.query,
            max_results=job.max_results,
            progress_callback=maps_progress,
            known_place_ids=known_place_ids,
        )

        job.total_found = len(maps_results)
        log(f"Fase 1 concluida: {len(maps_results)} empresas encontradas")
        await db.commit()

        if not maps_results:
            job.status = JobStatus.concluido
            job.progress = 100
            job.finished_at = datetime.utcnow()
            log("Nenhum resultado encontrado. Tente outra busca.")
            await db.commit()
            return

        job.progress = 50
        await db.commit()

        # ─── FASE 2: Enriquecimento de websites (streaming — sem espera de lote) ──
        log("Fase 2: Visitando websites para extrair emails...")
        await db.commit()

        from app.scraper.website_scraper import WebsiteScraper
        from app.core.config import settings as _cfg

        website_scraper = WebsiteScraper(timeout=_cfg.SCRAPER_WEBSITE_TIMEOUT)
        semaphore = asyncio.Semaphore(_cfg.SCRAPER_ENRICH_CONCURRENCY)

        total_leads = 0
        total_emails = 0
        done_count = 0

        async def _enrich_one(lead_data: dict) -> dict:
            """Enriquece um lead; o semáforo controla quantos rodam ao mesmo tempo."""
            # Pula website visit se o lead já tem email no banco
            if lead_data.get("place_id") in enriched_place_ids:
                return lead_data
            if not lead_data.get("website"):
                return lead_data
            async with semaphore:
                try:
                    enrichment = await website_scraper.enrich_lead(lead_data["website"])
                    for key, value in enrichment.items():
                        if value and not lead_data.get(key):
                            lead_data[key] = value
                except Exception as e:
                    logger.debug(f"Enriquecimento '{lead_data.get('nome', '?')}': {type(e).__name__}")
            return lead_data

        # Dispara TODOS de uma vez — o semáforo limita os simultâneos.
        # Assim que um site responde, o próximo começa imediatamente (sem
        # esperar os lentos do mesmo lote).
        tasks = [asyncio.create_task(_enrich_one(ld)) for ld in maps_results]

        for fut in asyncio.as_completed(tasks):
            # Checa cancelamento antes de processar cada resultado
            if running_jobs.get(job_id) is False:
                for t in tasks:
                    t.cancel()
                log("Job cancelado pelo usuario")
                break

            lead_data = await fut
            done_count += 1
            nome = lead_data.get("nome", "?")

            # ── Filtros de qualidade ───────────────────────────────────────
            if only_with_phone and not lead_data.get("telefone"):
                logger.debug(f"Descartado (sem telefone): {nome}")
            elif only_with_email and not lead_data.get("email"):
                logger.debug(f"Descartado (sem email): {nome}")
            else:
                if lead_data.get("email"):
                    total_emails += 1
                    log(f"Email: {lead_data['email']} ({nome})")

                try:
                    await LeadService.upsert_lead(db, lead_data, job_id=job_id)
                    total_leads += 1
                except Exception as e:
                    logger.warning(f"Erro ao salvar '{nome}': {e}")
                    try:
                        await db.rollback()
                    except Exception:
                        pass

            # Progresso: 50% → 100% conforme leads chegam
            job.progress = 50 + int(done_count / len(maps_results) * 50)
            job.total_scraped = total_leads
            job.total_emails = total_emails

            # Commit a cada 5 finalizados para não sobrecarregar o DB
            if done_count % 5 == 0 or done_count == len(maps_results):
                try:
                    await db.commit()
                except Exception as e:
                    logger.warning(f"Erro ao commitar: {e}")

        # ─── FINALIZACAO ──────────────────────────────────────────────────
        job.status = JobStatus.concluido
        job.progress = 100
        job.total_scraped = total_leads
        job.total_emails = total_emails
        job.finished_at = datetime.utcnow()

        duration = int((job.finished_at - started_at).total_seconds())
        log(f"Concluido! {total_leads} leads | {total_emails} emails | {duration}s")
        await db.commit()

        logger.info(f"Job {job_id} OK: {total_leads} leads, {total_emails} emails, {duration}s")

    @staticmethod
    async def cancel_job(db: AsyncSession, job_id: str) -> bool:
        job = await ScrapingService._get_job(db, job_id)
        if not job:
            return False
        running_jobs[str(job_id)] = False  # Sinaliza para parar
        job.status = JobStatus.cancelado
        job.finished_at = datetime.utcnow()
        await db.commit()
        return True

    @staticmethod
    async def _get_job(db: AsyncSession, job_id: str) -> Optional[ScrapingJob]:
        result = await db.execute(select(ScrapingJob).where(ScrapingJob.id == job_id))
        return result.scalar_one_or_none()
