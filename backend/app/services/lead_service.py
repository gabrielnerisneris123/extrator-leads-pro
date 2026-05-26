from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload
from app.models.lead import Lead, LeadNote, LeadStatus
from app.models.scraping_job import ScrapingJob, JobStatus
from app.schemas.lead import LeadCreate, LeadUpdate, LeadFilter, LeadListOut
from loguru import logger
import math


class LeadService:

    @staticmethod
    async def create_lead(db: AsyncSession, data: LeadCreate, job_id: Optional[str] = None) -> Lead:
        lead = Lead(
            **data.model_dump(exclude_none=True),
            job_id=job_id,
            has_email=bool(data.email),
            has_whatsapp=bool(data.whatsapp),
            has_instagram=bool(data.instagram),
            has_website=bool(data.website),
        )
        db.add(lead)
        await db.flush()
        return lead

    @staticmethod
    async def upsert_lead(
        db: AsyncSession, data: Dict[str, Any], job_id: Optional[str] = None
    ) -> Lead:
        """Insert or update based on place_id."""
        place_id = data.get("place_id")
        existing = None

        if place_id:
            result = await db.execute(
                select(Lead).where(Lead.place_id == place_id)
            )
            existing = result.scalar_one_or_none()

        if existing:
            for key, value in data.items():
                if value and hasattr(existing, key):
                    setattr(existing, key, value)
            existing.has_email = bool(existing.email)
            existing.has_whatsapp = bool(existing.whatsapp)
            existing.has_instagram = bool(existing.instagram)
            existing.has_website = bool(existing.website)
            if job_id:
                existing.job_id = job_id
            await db.flush()
            return existing
        else:
            # Filter only valid Lead fields
            valid_fields = {c.name for c in Lead.__table__.columns}
            lead_data = {k: v for k, v in data.items() if k in valid_fields and v is not None}
            lead = Lead(
                **lead_data,
                job_id=job_id,
                has_email=bool(data.get("email")),
                has_whatsapp=bool(data.get("whatsapp")),
                has_instagram=bool(data.get("instagram")),
                has_website=bool(data.get("website")),
            )
            db.add(lead)
            await db.flush()
            return lead

    @staticmethod
    async def get_lead(db: AsyncSession, lead_id: str) -> Optional[Lead]:
        result = await db.execute(
            select(Lead)
            .options(selectinload(Lead.notes))
            .where(Lead.id == lead_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_lead(db: AsyncSession, lead_id: str, data: LeadUpdate) -> Optional[Lead]:
        lead = await LeadService.get_lead(db, lead_id)
        if not lead:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(lead, key, value)
        if "email" in update_data:
            lead.has_email = bool(data.email)
        if "whatsapp" in update_data:
            lead.has_whatsapp = bool(data.whatsapp)
        await db.flush()
        return lead

    @staticmethod
    async def delete_lead(db: AsyncSession, lead_id: str) -> bool:
        lead = await LeadService.get_lead(db, lead_id)
        if not lead:
            return False
        await db.delete(lead)
        return True

    @staticmethod
    async def list_leads(db: AsyncSession, filters: LeadFilter) -> LeadListOut:
        query = select(Lead).options(selectinload(Lead.notes))
        count_query = select(func.count(Lead.id))

        conditions = []

        if filters.search:
            search_term = f"%{filters.search}%"
            conditions.append(
                or_(
                    Lead.nome.ilike(search_term),
                    Lead.email.ilike(search_term),
                    Lead.cidade.ilike(search_term),
                    Lead.categoria.ilike(search_term),
                    Lead.telefone.ilike(search_term),
                )
            )

        if filters.cidade:
            conditions.append(Lead.cidade.ilike(f"%{filters.cidade}%"))
        if filters.estado:
            conditions.append(Lead.estado.ilike(f"%{filters.estado}%"))
        if filters.categoria:
            conditions.append(Lead.categoria.ilike(f"%{filters.categoria}%"))
        if filters.status:
            conditions.append(Lead.status == filters.status)
        if filters.has_email is not None:
            conditions.append(Lead.has_email == filters.has_email)
        if filters.has_whatsapp is not None:
            conditions.append(Lead.has_whatsapp == filters.has_whatsapp)
        if filters.has_instagram is not None:
            conditions.append(Lead.has_instagram == filters.has_instagram)
        if filters.has_telefone is not None:
            if filters.has_telefone:
                conditions.append(and_(Lead.telefone.isnot(None), Lead.telefone != ""))
            else:
                conditions.append(or_(Lead.telefone.is_(None), Lead.telefone == ""))
        if filters.nota_min is not None:
            conditions.append(Lead.nota >= filters.nota_min)
        if filters.reviews_min is not None:
            conditions.append(Lead.total_reviews >= filters.reviews_min)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Sorting — only sort by valid columns
        valid_sort_cols = {
            "nome": Lead.nome, "scraped_at": Lead.scraped_at,
            "nota": Lead.nota, "cidade": Lead.cidade,
            "total_reviews": Lead.total_reviews, "updated_at": Lead.updated_at,
        }
        sort_col = valid_sort_cols.get(filters.sort_by, Lead.scraped_at)
        query = query.order_by(asc(sort_col) if filters.sort_order == "asc" else desc(sort_col))

        # Count
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        # Paginate
        offset = (filters.page - 1) * filters.size
        query = query.offset(offset).limit(filters.size)

        result = await db.execute(query)
        leads = result.scalars().all()

        return LeadListOut(
            items=leads,
            total=total,
            page=filters.page,
            size=filters.size,
            pages=math.ceil(total / filters.size) if total > 0 else 1,
        )

    @staticmethod
    async def add_note(db: AsyncSession, lead_id: str, content: str, user_id: Optional[str] = None) -> LeadNote:
        note = LeadNote(lead_id=lead_id, content=content, user_id=user_id)
        db.add(note)
        await db.flush()
        return note

    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
        from datetime import datetime, timedelta

        total = (await db.execute(select(func.count(Lead.id)))).scalar_one()
        with_email = (await db.execute(select(func.count(Lead.id)).where(Lead.has_email == True))).scalar_one()
        with_whatsapp = (await db.execute(select(func.count(Lead.id)).where(Lead.has_whatsapp == True))).scalar_one()
        with_instagram = (await db.execute(select(func.count(Lead.id)).where(Lead.has_instagram == True))).scalar_one()

        novos = (await db.execute(select(func.count(Lead.id)).where(Lead.status == LeadStatus.novo))).scalar_one()
        negociacao = (await db.execute(select(func.count(Lead.id)).where(Lead.status == LeadStatus.negociacao))).scalar_one()
        fechados = (await db.execute(select(func.count(Lead.id)).where(Lead.status == LeadStatus.fechado))).scalar_one()

        city_result = await db.execute(
            select(Lead.cidade, func.count(Lead.id).label("count"))
            .where(Lead.cidade.isnot(None))
            .group_by(Lead.cidade)
            .order_by(desc("count"))
            .limit(10)
        )
        by_cidade = [{"cidade": r[0], "count": r[1]} for r in city_result.all()]

        niche_result = await db.execute(
            select(Lead.categoria, func.count(Lead.id).label("count"))
            .where(Lead.categoria.isnot(None))
            .group_by(Lead.categoria)
            .order_by(desc("count"))
            .limit(10)
        )
        by_nicho = [{"nicho": r[0], "count": r[1]} for r in niche_result.all()]

        status_result = await db.execute(
            select(Lead.status, func.count(Lead.id).label("count"))
            .group_by(Lead.status)
        )
        by_status = [{"status": r[0].value, "count": r[1]} for r in status_result.all()]

        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        day_result = await db.execute(
            select(
                func.date(Lead.scraped_at).label("day"),
                func.count(Lead.id).label("count")
            )
            .where(Lead.scraped_at >= thirty_days_ago)
            .group_by(func.date(Lead.scraped_at))
            .order_by("day")
        )
        by_day = [{"day": str(r[0]), "count": r[1]} for r in day_result.all()]

        total_jobs = (await db.execute(select(func.count(ScrapingJob.id)))).scalar_one()
        jobs_running = (await db.execute(
            select(func.count(ScrapingJob.id)).where(ScrapingJob.status == JobStatus.executando)
        )).scalar_one()

        return {
            "total_leads": total,
            "leads_with_email": with_email,
            "leads_with_whatsapp": with_whatsapp,
            "leads_with_instagram": with_instagram,
            "leads_novos": novos,
            "leads_em_negociacao": negociacao,
            "leads_fechados": fechados,
            "taxa_email": round((with_email / total * 100), 1) if total > 0 else 0,
            "taxa_whatsapp": round((with_whatsapp / total * 100), 1) if total > 0 else 0,
            "total_jobs": total_jobs,
            "jobs_running": jobs_running,
            "leads_by_cidade": by_cidade,
            "leads_by_nicho": by_nicho,
            "leads_by_status": by_status,
            "leads_by_day": by_day,
            "top_cidades": by_cidade[:5],
            "top_nichos": by_nicho[:5],
        }
