from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import sys
import os

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import auth, leads, scraping, export, dashboard, github

# UTF-8 output (Windows compatibility — ignorado em Linux/Vercel)
try:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Configure loguru
logger.remove()
logger.add(
    sys.stdout,
    colorize=False,
    format="{time:HH:mm:ss} | {level: <8} | {name} - {message}",
    level="DEBUG" if settings.DEBUG else "INFO",
)

# Log em arquivo (apenas quando filesystem disponível — local dev)
try:
    os.makedirs("logs", exist_ok=True)
    logger.add(
        "logs/app.log",
        rotation="10 MB",
        retention="7 days",
        level="INFO",
    )
except Exception:
    pass  # Vercel tem filesystem somente leitura


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    try:
        await init_db()
        await create_default_admin()
        logger.info("Application ready!")
    except Exception as e:
        # Não crasha o app se o banco falhar no startup (ex: Neon sleeping)
        logger.error(f"Startup DB error (continuing): {e}")
    yield
    logger.info("Shutting down...")


async def create_default_admin():
    from app.core.database import AsyncSessionLocal
    from app.core.security import get_password_hash
    from app.models.user import User
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == settings.ADMIN_EMAIL)
        )
        if not result.scalar_one_or_none():
            admin = User(
                email=settings.ADMIN_EMAIL,
                full_name="Administrador",
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            logger.info(f"Admin user created: {settings.ADMIN_EMAIL}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Sistema profissional de extracao e gestao de leads empresariais",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # qualquer deploy Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(scraping.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(github.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
