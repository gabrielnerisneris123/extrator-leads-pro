"""
Scraping service - gerencia jobs e orquestra scrapers.

Lógica principal:
  - Busca página por página no Google Maps (1 crédito = 20 resultados)
  - Enriquece cada página (visita sites, extrai email)
  - Para assim que tiver `max_results` leads VÁLIDOS (com telefone/email se filtros ativos)
  - Não gasta mais créditos do que o necessário
"""
import asyncio
import traceback
import httpx
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.scraping_job import ScrapingJob, JobStatus
from app.services.lead_service import LeadService
from app.core.database import AsyncSessionLocal
from app.core.config import settings
from loguru import logger

RESULTS_PER_PAGE = 20  # SerpAPI retorna 20 por crédito

# Rastreia jobs: job_id -> True (rodando) / False (cancelado)
running_jobs: dict = {}


class ScrapingService:

    @staticmethod
    async def create_job(
        db: AsyncSession,
        query: str,
        max_results: int = 20,
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

            started_at = datetime.utcnow()
            job.status = JobStatus.executando
            job.started_at = started_at
            job.logs = f"[{started_at.strftime('%H:%M:%S')}] Job iniciado\n"
            await db.commit()

            running_jobs[str(job_id)] = True
            logger.info(f"Iniciando scraping: '{job.query}' (meta: {job.max_results} válidos)")

            try:
                await ScrapingService._execute_scraping(db, job, started_at)

            except asyncio.CancelledError:
                job.status = JobStatus.cancelado
                job.logs = (job.logs or "") + f"[{datetime.utcnow().strftime('%H:%M:%S')}] Cancelado\n"
                await db.commit()

            except Exception as e:
                full_tb = traceback.format_exc()
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
        """
        Busca página por página até atingir `max_results` leads VÁLIDOS.

        Fluxo por página:
          1. Busca 20 resultados do Google Maps (1 crédito)
          2. Filtra duplicatas (place_ids já no banco)
          3. Enriquece os novos (visita sites para extrair email — concorrente)
          4. Salva apenas os que passam nos filtros (telefone/email)
          5. Para quando tiver leads válidos suficientes ou acabar as páginas
        """
        job_id = str(job.id)

        cfg = job.config or {}
        only_with_phone = cfg.get("only_with_phone", False)
        only_with_email = cfg.get("only_with_email", False)
        target_valid = job.max_results  # Meta: leads VÁLIDOS (não total buscado)

        def log(msg: str):
            ts = datetime.utcnow().strftime('%H:%M:%S')
            job.logs = (job.logs or "") + f"[{ts}] {msg}\n"

        # ── Monta descrição dos filtros ───────────────────────────────────────
        filtros_ativos = []
        if only_with_phone:
            filtros_ativos.append("telefone")
        if only_with_email:
            filtros_ativos.append("e-mail")
        filtros_str = f" | Requer: {' + '.join(filtros_ativos)}" if filtros_ativos else ""

        log(f"Meta: {target_valid} leads válidos{filtros_str}")

        # ── Carrega place_ids já no banco (dedup) ─────────────────────────────
        from app.models.lead import Lead as LeadModel
        from sqlalchemy import and_ as sql_and
        known_result = await db.execute(
            select(LeadModel.place_id).where(LeadModel.place_id.isnot(None))
        )
        known_place_ids = {row[0] for row in known_result.all()}

        enriched_result = await db.execute(
            select(LeadModel.place_id).where(
                sql_and(LeadModel.place_id.isnot(None), LeadModel.has_email == True)
            )
        )
        enriched_place_ids = {row[0] for row in enriched_result.all()}

        if known_place_ids:
            log(f"Dedup: {len(known_place_ids)} leads já no banco ({len(enriched_place_ids)} com e-mail)")

        await db.commit()

        # ── Setup scrapers ────────────────────────────────────────────────────
        from app.scraper.serp_maps import SerpApiMapsScraper
        from app.scraper.website_scraper import WebsiteScraper
        from app.scraper.utils import parse_query_location
        from app.core.config import settings as _cfg

        scraper = SerpApiMapsScraper()
        website_scraper = WebsiteScraper(timeout=_cfg.SCRAPER_WEBSITE_TIMEOUT)
        semaphore = asyncio.Semaphore(_cfg.SCRAPER_ENRICH_CONCURRENCY)
        location_data = parse_query_location(job.query)

        async def _enrich_one(lead_data: dict) -> dict:
            """Enriquece um lead visitando o website; semáforo limita simultâneos."""
            if lead_data.get("place_id") in enriched_place_ids:
                return lead_data  # Já tem email no banco — pula
            if not lead_data.get("website"):
                return lead_data  # Sem site — nada a extrair
            async with semaphore:
                try:
                    enrichment = await website_scraper.enrich_lead(lead_data["website"])
                    for k, v in enrichment.items():
                        if v and not lead_data.get(k):
                            lead_data[k] = v
                except Exception as e:
                    logger.debug(f"Enriquecimento '{lead_data.get('nome', '?')}': {type(e).__name__}")
            return lead_data

        # ── Loop principal: página por página ─────────────────────────────────
        valid_count = 0      # Leads que passaram nos filtros e foram salvos
        page_start = 0       # Offset da página atual no SerpAPI
        credits_used = 0     # Créditos SerpAPI gastos
        total_discarded = 0  # Leads descartados por não ter telefone/email

        async with httpx.AsyncClient(timeout=30.0) as maps_client:

            while valid_count < target_valid:

                # Checa cancelamento
                if running_jobs.get(job_id) is False:
                    log("Cancelado pelo usuário")
                    break

                # ── FASE 1: Busca uma página no Google Maps (1 crédito) ────────
                log(f"Buscando página {credits_used + 1} no Google Maps...")
                await db.commit()

                try:
                    page_results, has_more = await scraper._fetch_page(
                        maps_client, job.query, page_start, location_data
                    )
                except Exception as e:
                    log(f"Erro na API SerpAPI: {e}")
                    break

                credits_used += 1

                if not page_results:
                    log(f"Sem mais resultados no Google Maps ({credits_used} crédito(s) usados)")
                    break

                # Remove duplicatas (já no banco)
                new_results = [
                    r for r in page_results
                    if r.get("place_id") not in known_place_ids
                ]
                dup_count = len(page_results) - len(new_results)

                log(
                    f"Página {credits_used}: {len(new_results)} novos"
                    + (f" | {dup_count} já no banco" if dup_count else "")
                )
                await db.commit()

                if len(new_results) == 0:
                    # Página 100% duplicada — páginas seguintes também serão
                    log(f"Página 100% duplicada — interrompendo paginação")
                    break

                # ── FASE 2: Enriquece esta página de forma concorrente ─────────
                tasks = [asyncio.create_task(_enrich_one(r)) for r in new_results]

                for fut in asyncio.as_completed(tasks):

                    if running_jobs.get(job_id) is False:
                        for t in tasks:
                            t.cancel()
                        break

                    lead_data = await fut
                    nome = lead_data.get("nome", "?")

                    # ── Filtros de qualidade ────────────────────────────────────
                    passes = True
                    if only_with_phone and not lead_data.get("telefone"):
                        passes = False
                    if only_with_email and not lead_data.get("email"):
                        passes = False

                    if not passes:
                        total_discarded += 1
                        continue

                    # ── Lead válido: salva no banco ────────────────────────────
                    if lead_data.get("email"):
                        log(f"✓ {nome} | {lead_data['email']}")
                    else:
                        log(f"✓ {nome}")

                    try:
                        await LeadService.upsert_lead(db, lead_data, job_id=job_id)
                        valid_count += 1
                        # Adiciona ao dedup local para não reprocessar nesta sessão
                        if lead_data.get("place_id"):
                            known_place_ids.add(lead_data["place_id"])
                    except Exception as e:
                        logger.warning(f"Erro ao salvar '{nome}': {e}")
                        try:
                            await db.rollback()
                        except Exception:
                            pass

                    # Atualiza progresso (% baseado na meta)
                    job.progress = min(95, int(valid_count / target_valid * 100))
                    job.total_scraped = valid_count
                    job.total_found = page_start + len(page_results)

                    # ── Meta atingida: para imediatamente ─────────────────────
                    if valid_count >= target_valid:
                        for t in tasks:
                            t.cancel()
                        break

                await db.commit()

                # Saiu do loop de leads desta página
                if valid_count >= target_valid:
                    log(
                        f"Meta atingida! {valid_count} leads válidos | "
                        f"{credits_used} crédito(s) | "
                        f"{total_discarded} sem telefone/e-mail descartados"
                    )
                    break

                if not has_more:
                    log(f"Sem mais páginas. Total: {valid_count} leads válidos | {credits_used} crédito(s)")
                    break

                page_start += RESULTS_PER_PAGE
                await asyncio.sleep(0.3)  # Respeita rate limit

        # ── FINALIZAÇÃO ───────────────────────────────────────────────────────
        job.status = JobStatus.concluido
        job.progress = 100
        job.total_scraped = valid_count
        job.finished_at = datetime.utcnow()

        duration = int((job.finished_at - started_at).total_seconds())
        log(
            f"Concluído! {valid_count}/{target_valid} leads válidos | "
            f"{credits_used} crédito(s) | "
            f"{total_discarded} descartados | "
            f"{duration}s"
        )
        await db.commit()

        logger.info(
            f"Job {job_id}: {valid_count} leads válidos, "
            f"{credits_used} crédito(s), {total_discarded} descartados, {duration}s"
        )

    @staticmethod
    async def cancel_job(db: AsyncSession, job_id: str) -> bool:
        job = await ScrapingService._get_job(db, job_id)
        if not job:
            return False
        running_jobs[str(job_id)] = False
        job.status = JobStatus.cancelado
        job.finished_at = datetime.utcnow()
        await db.commit()
        return True

    @staticmethod
    async def _get_job(db: AsyncSession, job_id: str) -> Optional[ScrapingJob]:
        result = await db.execute(select(ScrapingJob).where(ScrapingJob.id == job_id))
        return result.scalar_one_or_none()
