from sqlalchemy import (
    Column, String, Float, Integer, DateTime, Text,
    Boolean, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.core.database import Base


class LeadStatus(str, enum.Enum):
    novo = "novo"
    contato_iniciado = "contato_iniciado"
    negociacao = "negociacao"
    fechado = "fechado"
    descartado = "descartado"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Basic Info
    nome = Column(String(500), nullable=False, index=True)
    categoria = Column(String(255), index=True)
    website = Column(Text)

    # Contact
    telefone = Column(String(50))
    email = Column(String(255), index=True)
    whatsapp = Column(String(50))

    # Social
    instagram = Column(String(255))
    facebook = Column(String(255))
    linkedin = Column(String(255))

    # Location
    endereco = Column(Text)
    cidade = Column(String(255), index=True)
    estado = Column(String(100), index=True)
    cep = Column(String(20))

    # Google Maps
    google_maps_url = Column(Text)
    nota = Column(Float)
    total_reviews = Column(Integer, default=0)
    place_id = Column(String(255), unique=True, index=True)

    # Status & CRM
    status = Column(SAEnum(LeadStatus), default=LeadStatus.novo, index=True)
    observacoes = Column(Text)
    tags = Column(JSON, default=list)  # SQLite-compatible (JSON instead of ARRAY)

    # Metadata
    scraped_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    job_id = Column(String(36), ForeignKey("scraping_jobs.id"), nullable=True)

    # Flags (computed for fast filtering)
    has_email = Column(Boolean, default=False)
    has_whatsapp = Column(Boolean, default=False)
    has_instagram = Column(Boolean, default=False)
    has_website = Column(Boolean, default=False)

    # Relationships
    job = relationship("ScrapingJob", back_populates="leads")
    notes = relationship("LeadNote", back_populates="lead", cascade="all, delete-orphan")


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    lead = relationship("Lead", back_populates="notes")
