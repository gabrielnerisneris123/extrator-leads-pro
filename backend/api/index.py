"""
Vercel entry point para o backend FastAPI.
handler deve estar no top-level para o runtime do Vercel detectar.
"""
import sys
import os
import traceback
import asyncio

# Adiciona o diretório backend/ ao path para importar app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum  # noqa — precisa estar antes de tudo

_import_error: str | None = None

try:
    from app.main import app

    # Inicializa o banco de dados de forma síncrona no cold start
    # (lifespan="off" evita conflitos com o event loop do mangum)
    _loop = asyncio.new_event_loop()
    try:
        from app.core.database import init_db
        from app.main import create_default_admin
        _loop.run_until_complete(init_db())
        _loop.run_until_complete(create_default_admin())
        print("[startup] DB initialized", flush=True)
    except Exception as _db_err:
        print(f"[startup] DB init error (non-fatal): {_db_err}", flush=True)
    finally:
        _loop.close()
        del _loop

except Exception:
    _import_error = traceback.format_exc()
    print(f"[startup] IMPORT ERROR:\n{_import_error}", flush=True)

    from fastapi import FastAPI
    _err_detail = _import_error

    app = FastAPI()

    @app.get("/{path:path}")
    async def _error_route(path: str = ""):
        return {
            "status": "import_error",
            "error": _err_detail,
            "python_version": sys.version,
        }

# handler SEMPRE no top-level — Vercel exige isso
handler = Mangum(app, lifespan="off")
