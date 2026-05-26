from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.scraping_job import JobStatus


class ScrapingJobCreate(BaseModel):
    query: str = Field(..., min_length=3, description="ex: academias em campinas")
    max_results: int = Field(default=100, ge=1, le=1000)
    extract_emails: bool = True
    extract_socials: bool = True
    # Filtros de qualidade: descartar leads que não tenham esses contatos
    only_with_phone: bool = False
    only_with_email: bool = False


class ScrapingJobOut(BaseModel):
    id: str
    query: str
    cidade: Optional[str] = None
    estado: Optional[str] = None
    nicho: Optional[str] = None
    max_results: int
    status: JobStatus
    progress: int
    total_found: int
    total_scraped: int
    total_emails: int
    error_message: Optional[str] = None
    logs: Optional[str] = None
    config: Optional[dict] = None   # inclui only_with_phone / only_with_email
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScrapingJobListOut(BaseModel):
    items: List[ScrapingJobOut]
    total: int


class DashboardStats(BaseModel):
    total_leads: int
    leads_with_email: int
    leads_with_whatsapp: int
    leads_with_instagram: int
    leads_novos: int
    leads_em_negociacao: int
    leads_fechados: int
    taxa_email: float
    taxa_whatsapp: float
    total_jobs: int
    jobs_running: int
    leads_by_cidade: List[dict]
    leads_by_nicho: List[dict]
    leads_by_status: List[dict]
    leads_by_day: List[dict]
    top_cidades: List[dict]
    top_nichos: List[dict]
