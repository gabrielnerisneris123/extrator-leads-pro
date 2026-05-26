from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from app.models.lead import LeadStatus


class LeadNoteCreate(BaseModel):
    content: str


class LeadNoteOut(BaseModel):
    id: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class LeadCreate(BaseModel):
    nome: str
    categoria: Optional[str] = None
    website: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    linkedin: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    google_maps_url: Optional[str] = None
    nota: Optional[float] = None
    total_reviews: Optional[int] = 0
    place_id: Optional[str] = None


class LeadUpdate(BaseModel):
    nome: Optional[str] = None
    status: Optional[LeadStatus] = None
    observacoes: Optional[str] = None
    tags: Optional[List[str]] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None


class LeadOut(BaseModel):
    id: str
    nome: str
    categoria: Optional[str] = None
    website: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    linkedin: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    google_maps_url: Optional[str] = None
    nota: Optional[float] = None
    total_reviews: Optional[int] = None
    place_id: Optional[str] = None
    status: LeadStatus
    observacoes: Optional[str] = None
    tags: Optional[Any] = []
    has_email: bool = False
    has_whatsapp: bool = False
    has_instagram: bool = False
    has_website: bool = False
    scraped_at: datetime
    updated_at: datetime
    job_id: Optional[str] = None
    notes: List[LeadNoteOut] = []

    class Config:
        from_attributes = True


class LeadListOut(BaseModel):
    items: List[LeadOut]
    total: int
    page: int
    size: int
    pages: int


class LeadFilter(BaseModel):
    search: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    categoria: Optional[str] = None
    status: Optional[LeadStatus] = None
    has_email: Optional[bool] = None
    has_whatsapp: Optional[bool] = None
    has_instagram: Optional[bool] = None
    has_telefone: Optional[bool] = None   # novo filtro
    nota_min: Optional[float] = None
    reviews_min: Optional[int] = None
    tags: Optional[List[str]] = None
    page: int = Field(default=1, ge=1)
    size: int = Field(default=50, ge=1, le=500)
    sort_by: str = "scraped_at"
    sort_order: str = "desc"
