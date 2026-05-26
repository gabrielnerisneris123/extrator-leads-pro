"""
Google Maps Scraper usando SerpAPI.
Substitui o scraper Playwright com chamadas à API REST do SerpAPI.
Documentação: https://serpapi.com/google-maps-api
"""
import asyncio
import re
from typing import List, Optional, Dict, Any, Callable

import httpx
from loguru import logger

from app.core.config import settings
from app.scraper.utils import parse_query_location, clean_text, _ESTADOS_BR

SERPAPI_ENDPOINT = "https://serpapi.com/search"
RESULTS_PER_PAGE = 20  # SerpAPI retorna até 20 resultados por página


class SerpApiMapsScraper:
    """
    Busca empresas no Google Maps via SerpAPI.

    Uso:
        scraper = SerpApiMapsScraper()
        results = await scraper.scrape_query("academias em campinas sp", max_results=50)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.SERPAPI_KEY

    async def scrape_query(
        self,
        query: str,
        max_results: int = 100,
        progress_callback: Optional[Callable] = None,
        known_place_ids: Optional[set] = None,
    ) -> List[Dict[str, Any]]:
        """
        Busca no Google Maps e retorna lista de leads.

        Args:
            query:             Texto de busca, ex: "pizzarias em são paulo sp"
            max_results:       Número máximo de resultados a coletar
            progress_callback: async fn(scraped, total, current_name)
            known_place_ids:   place_ids já no banco — para de paginar quando
                               uma página inteira é de duplicatas (economiza créditos)

        Returns:
            Lista de dicts com dados de cada empresa
        """
        if not self.api_key:
            raise ValueError(
                "SERPAPI_KEY não configurada. "
                "Adicione SERPAPI_KEY=sua_chave no arquivo backend/.env"
            )

        known_place_ids = known_place_ids or set()
        location_data = parse_query_location(query)
        results: List[Dict[str, Any]] = []
        start = 0
        credits_used = 0

        logger.info(f"[SerpAPI] Iniciando busca: '{query}' (max: {max_results})")

        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(results) < max_results:
                page_results, has_more = await self._fetch_page(
                    client, query, start, location_data
                )
                credits_used += 1

                # Separa resultados novos dos já existentes no banco
                new_results = [
                    r for r in page_results
                    if r.get("place_id") not in known_place_ids
                ]
                duplicate_count = len(page_results) - len(new_results)

                logger.info(
                    f"[SerpAPI] Página start={start}: {len(page_results)} resultados "
                    f"| {len(new_results)} novos, {duplicate_count} já no banco "
                    f"| Total novo: {len(results) + len(new_results)}"
                )

                for item in new_results:
                    if len(results) >= max_results:
                        break
                    results.append(item)

                    if progress_callback:
                        estimated_total = min(max_results, len(results) + len(new_results))
                        await progress_callback(
                            scraped=len(results),
                            total=estimated_total,
                            current_name=item.get("nome", ""),
                        )

                # Para de paginar se a página inteira já está no banco
                # (próximas páginas também terão duplicatas → economiza créditos)
                if page_results and len(new_results) == 0:
                    logger.info(
                        f"[SerpAPI] Página 100% duplicada — parando paginação "
                        f"({credits_used} crédito(s) usados)"
                    )
                    break

                if not has_more or not page_results:
                    break

                start += RESULTS_PER_PAGE
                await asyncio.sleep(0.3)

        logger.info(
            f"[SerpAPI] Concluído: {len(results)} empresas novas | {credits_used} crédito(s) usados"
        )
        return results

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        query: str,
        start: int,
        location_data: dict,
    ) -> tuple[List[Dict[str, Any]], bool]:
        """
        Busca uma página de resultados na SerpAPI.

        Returns:
            (lista_de_leads, tem_mais_paginas)
        """
        params = {
            "engine": "google_maps",
            "q": query,
            "api_key": self.api_key,
            "hl": "pt-br",
            "gl": "br",
            "start": start,
        }

        try:
            response = await client.get(SERPAPI_ENDPOINT, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[SerpAPI] HTTP {e.response.status_code}: {e.response.text[:300]}")
            raise
        except Exception as e:
            logger.error(f"[SerpAPI] Erro na requisição: {e}")
            raise

        # Verificar erros da API
        if "error" in data:
            raise RuntimeError(f"SerpAPI error: {data['error']}")

        local_results = data.get("local_results", [])
        leads = []

        for item in local_results:
            lead = self._parse_result(item, location_data)
            if lead:
                leads.append(lead)

        # Verifica se há próxima página
        has_more = bool(
            data.get("serpapi_pagination", {}).get("next")
            and len(local_results) == RESULTS_PER_PAGE
        )

        return leads, has_more

    def _parse_result(self, item: dict, location_data: dict) -> Optional[Dict[str, Any]]:
        """Converte um resultado da SerpAPI para o formato interno de lead."""
        nome = item.get("title")
        if not nome:
            return None

        address = item.get("address", "") or ""

        # Tenta extrair cidade/estado do endereço primeiro, usa localdata como fallback
        cidade = location_data.get("cidade") or ""
        estado = location_data.get("estado") or ""
        city_state = self._parse_city_state(address)
        if city_state:
            cidade = city_state.get("cidade") or cidade
            estado = city_state.get("estado") or estado

        # Nota (rating) — SerpAPI retorna float
        nota = item.get("rating")
        if nota is not None:
            try:
                nota = float(nota)
            except (TypeError, ValueError):
                nota = None

        # Total de avaliações
        total_reviews = item.get("reviews", 0)
        try:
            total_reviews = int(total_reviews) if total_reviews else 0
        except (TypeError, ValueError):
            total_reviews = 0

        # URL do Google Maps
        place_id = item.get("place_id", "")
        maps_url = item.get("link") or (
            f"https://www.google.com/maps/place/?q=place_id:{place_id}" if place_id else ""
        )

        return {
            "nome": clean_text(nome),
            "categoria": item.get("type") or location_data.get("nicho") or "",
            "endereco": address,
            "cidade": cidade,
            "estado": estado,
            "telefone": item.get("phone") or None,
            "website": item.get("website") or None,
            "nota": nota,
            "total_reviews": total_reviews,
            "google_maps_url": maps_url,
            "place_id": place_id or None,
            # Campos que serão preenchidos na fase de enriquecimento
            "email": None,
            "whatsapp": None,
            "instagram": None,
            "facebook": None,
            "linkedin": None,
        }

    def _parse_city_state(self, address: str) -> Optional[dict]:
        """Extrai cidade e estado de um endereço brasileiro."""
        if not address:
            return None

        patterns = [
            r"(?:,\s*)([^,\-]+)\s*[-–]\s*([A-Z]{2})\s*,",
            r"(?:,\s*)([^,\-]+)\s*[-–]\s*([A-Z]{2})\s*$",
            r",\s*([^,]+),\s*([A-Z]{2})\s+\d{5}",
        ]
        for pattern in patterns:
            match = re.search(pattern, address)
            if match:
                estado = match.group(2).strip().upper()
                if estado in _ESTADOS_BR:
                    return {
                        "cidade": match.group(1).strip().title(),
                        "estado": estado,
                    }
        return None
