"""
Vercel entry point para o backend FastAPI.
"""
import sys
import os
import traceback

# Adiciona o diretório backend/ ao path para importar app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_import_error = None
_import_tb = None

try:
    from app.main import app as _real_app
    from mangum import Mangum
    handler = Mangum(_real_app, lifespan="auto")

except Exception as _e:
    _import_error = str(_e)
    _import_tb = traceback.format_exc()

    # Se a importação falhar, cria um app mínimo que mostra o erro
    from fastapi import FastAPI
    from mangum import Mangum

    _err_app = FastAPI()

    @_err_app.get("/{path:path}")
    async def _error(path: str = ""):
        return {
            "status": "import_error",
            "error": _import_error,
            "traceback": _import_tb,
            "python": sys.version,
            "sys_path": sys.path[:5],
        }

    handler = Mangum(_err_app, lifespan="off")
