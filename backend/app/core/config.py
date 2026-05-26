from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Extrator Leads Pro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database (SQLite por padrão para dev local)
    DATABASE_URL: str = "sqlite+aiosqlite:///./leads.db"

    # Auth
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # SerpAPI
    SERPAPI_KEY: str = ""  # Obrigatório — cadastre em https://serpapi.com/

    # Scraping (enriquecimento de websites)
    SCRAPER_ENRICH_CONCURRENCY: int = 25  # fetches simultâneos de websites
    SCRAPER_WEBSITE_TIMEOUT: int = 5     # segundos por site

    # Admin
    ADMIN_EMAIL: str = "admin@leadspro.com"
    ADMIN_PASSWORD: str = "Admin@123456"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
