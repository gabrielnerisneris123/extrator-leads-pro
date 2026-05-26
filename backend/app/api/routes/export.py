from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import Optional
import io
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.lead import Lead, LeadStatus
from app.services.export_service import leads_to_csv, leads_to_excel, leads_to_json

router = APIRouter(prefix="/export", tags=["export"])


async def _get_filtered_leads(
    db: AsyncSession,
    cidade: Optional[str] = None,
    estado: Optional[str] = None,
    categoria: Optional[str] = None,
    status_filter: Optional[LeadStatus] = None,
    has_email: Optional[bool] = None,
    has_whatsapp: Optional[bool] = None,
    limit: int = 10000,
) -> list:
    query = select(Lead)
    conditions = []

    if cidade:
        conditions.append(Lead.cidade.ilike(f"%{cidade}%"))
    if estado:
        conditions.append(Lead.estado.ilike(f"%{estado}%"))
    if categoria:
        conditions.append(Lead.categoria.ilike(f"%{categoria}%"))
    if status_filter:
        conditions.append(Lead.status == status_filter)
    if has_email is not None:
        conditions.append(Lead.has_email == has_email)
    if has_whatsapp is not None:
        conditions.append(Lead.has_whatsapp == has_whatsapp)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/csv")
async def export_csv(
    cidade: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    status_filter: Optional[LeadStatus] = Query(None, alias="status"),
    has_email: Optional[bool] = Query(None),
    has_whatsapp: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leads = await _get_filtered_leads(
        db, cidade, estado, categoria, status_filter, has_email, has_whatsapp
    )
    content = leads_to_csv(leads)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )


@router.get("/excel")
async def export_excel(
    cidade: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    status_filter: Optional[LeadStatus] = Query(None, alias="status"),
    has_email: Optional[bool] = Query(None),
    has_whatsapp: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leads = await _get_filtered_leads(
        db, cidade, estado, categoria, status_filter, has_email, has_whatsapp
    )
    content = leads_to_excel(leads)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=leads_export.xlsx"},
    )


@router.get("/json")
async def export_json(
    cidade: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    status_filter: Optional[LeadStatus] = Query(None, alias="status"),
    has_email: Optional[bool] = Query(None),
    has_whatsapp: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leads = await _get_filtered_leads(
        db, cidade, estado, categoria, status_filter, has_email, has_whatsapp
    )
    content = leads_to_json(leads)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=leads_export.json"},
    )
