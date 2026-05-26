from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from loguru import logger


def _build_db_url(raw_url: str) -> tuple[str, dict]:
    """
    Converte a URL do banco para o formato correto e retorna connect_args.
    - SQLite: adiciona check_same_thread=False
    - PostgreSQL (Neon/Cloud): converte para +asyncpg e trata SSL
    """
    url = raw_url
    connect_args: dict = {}

    if "sqlite" in url:
        connect_args = {"check_same_thread": False}

    elif "postgresql" in url or "postgres" in url:
        # Garante que usa o driver asyncpg
        if "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        # Neon exige SSL — converte sslmode=require para connect_args
        if "sslmode=require" in url:
            url = url.replace("?sslmode=require", "").replace("&sslmode=require", "")
            connect_args["ssl"] = "require"
        elif "neon.tech" in url or "supabase" in url:
            # Neon/Supabase sempre precisam de SSL mesmo sem flag explícita
            connect_args["ssl"] = "require"

    return url, connect_args


_db_url, _connect_args = _build_db_url(settings.DATABASE_URL)

engine = create_async_engine(
    _db_url,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,   # detecta conexões mortas
    pool_recycle=300,     # recicla conexões a cada 5 min (bom para Neon)
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        from app.models import lead, user, scraping_job  # noqa
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tabelas criadas/verificadas no banco de dados")
