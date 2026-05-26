from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.core.database import Base


class JobStatus(str, enum.Enum):
    pendente = "pendente"
    executando = "executando"
    concluido = "concluido"
    erro = "erro"
    cancelado = "cancelado"


class ScrapingJob(Base):
    __tablename__ = "scraping_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Config
    query = Column(String(500), nullable=False)
    cidade = Column(String(255))
    estado = Column(String(100))
    nicho = Column(String(255))
    max_results = Column(Integer, default=100)

    # Status
    status = Column(SAEnum(JobStatus), default=JobStatus.pendente, index=True)
    progress = Column(Integer, default=0)
    total_found = Column(Integer, default=0)
    total_scraped = Column(Integer, default=0)
    total_emails = Column(Integer, default=0)
    error_message = Column(Text)
    logs = Column(Text, default="")

    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    finished_at = Column(DateTime)

    # User
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Extra config (JSON instead of JSONB — SQLite compatible)
    config = Column(JSON, default=dict)

    # Relationships
    user = relationship("User", back_populates="scraping_jobs")
    leads = relationship("Lead", back_populates="job")
