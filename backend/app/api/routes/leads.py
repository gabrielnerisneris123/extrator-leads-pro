from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.lead import LeadOut, LeadUpdate, LeadListOut, LeadFilter, LeadNoteCreate, LeadNoteOut
from app.services.lead_service import LeadService
from app.models.lead import LeadStatus

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=LeadListOut)
async def list_leads(
    search: Optional[str] = Query(None),
    cidade: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    status_filter: Optional[LeadStatus] = Query(None, alias="status"),
    has_email: Optional[bool] = Query(None),
    has_whatsapp: Optional[bool] = Query(None),
    has_instagram: Optional[bool] = Query(None),
    nota_min: Optional[float] = Query(None),
    reviews_min: Optional[int] = Query(None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=500),
    sort_by: str = Query(default="scraped_at"),
    sort_order: str = Query(default="desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = LeadFilter(
        search=search,
        cidade=cidade,
        estado=estado,
        categoria=categoria,
        status=status_filter,
        has_email=has_email,
        has_whatsapp=has_whatsapp,
        has_instagram=has_instagram,
        nota_min=nota_min,
        reviews_min=reviews_min,
        page=page,
        size=size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return await LeadService.list_leads(db, filters)


@router.get("/stats/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select, func
    from app.models.lead import Lead
    total = (await db.execute(select(func.count(Lead.id)))).scalar_one()
    with_email = (await db.execute(select(func.count(Lead.id)).where(Lead.has_email == True))).scalar_one()
    return {"total": total, "with_email": with_email}


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = await LeadService.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: str,
    data: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = await LeadService.update_lead(db, lead_id, data)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await LeadService.delete_lead(db, lead_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead não encontrado")


@router.post("/{lead_id}/notes", response_model=LeadNoteOut, status_code=201)
async def add_note(
    lead_id: str,
    data: LeadNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = await LeadService.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    note = await LeadService.add_note(db, lead_id, data.content, current_user.id)
    return note
