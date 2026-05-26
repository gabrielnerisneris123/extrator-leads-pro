"""
Vercel entry point para o backend FastAPI.
"""
import sys
import os

# Adiciona o diretório backend/ ao path para importar app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa — FastAPI ASGI app
from mangum import Mangum

# handler no top-level — obrigatório para o Vercel detectar a função
handler = Mangum(app, lifespan="auto")
