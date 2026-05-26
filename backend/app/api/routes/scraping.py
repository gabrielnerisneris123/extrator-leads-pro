import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.scraping_job import ScrapingJob
from app.schemas.scraping import ScrapingJobCreate, ScrapingJobOut, ScrapingJobListOut
from app.services.scraping_service import ScrapingService

router = APIRouter(prefix="/scraping", tags=["scraping"])


@router.post("/jobs", response_model=ScrapingJobOut, status_code=201)
async def create_scraping_job(
    data: ScrapingJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await ScrapingService.create_job(
        db,
        query=data.query,
        max_results=data.max_results,
        user_id=current_user.id,
        only_with_phone=data.only_with_phone,
        only_with_email=data.only_with_email,
    )
    background_tasks.add_task(ScrapingService.run_job, job.id)
    return job


@router.get("/jobs", response_model=ScrapingJobListOut)
async def list_jobs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (await db.execute(select(func.count(ScrapingJob.id)))).scalar_one()
    result = await db.execute(
        select(ScrapingJob)
        .order_by(desc(ScrapingJob.created_at))
        .offset((page - 1) * size)
        .limit(size)
    )
    jobs = result.scalars().all()
    return ScrapingJobListOut(items=jobs, total=count)


@router.get("/jobs/{job_id}", response_model=ScrapingJobOut)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ScrapingJob).where(ScrapingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return job


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cancelled = await ScrapingService.cancel_job(db, job_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return {"message": "Job cancelado"}


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ScrapingJob).where(ScrapingJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    await db.delete(job)
