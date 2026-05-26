"""
Vercel entry point para o backend FastAPI.
O Vercel executa este arquivo como função serverless Python.
"""
import sys
import os

# Adiciona o diretório backend/ ao path para importar app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa — FastAPI app
from mangum import Mangum

# Adaptador ASGI → AWS Lambda / Vercel Serverless
handler = Mangum(app, lifespan="auto")
