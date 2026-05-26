"""
Google Maps Scraper using Playwright.
Extracts business listings without using any paid Google API.
"""
import asyncio
import re
import json
from typing import List, Optional, Dict, Any, Callable
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
from loguru import logger
from app.scraper.utils import (
    get_random_user_agent, human_delay, clean_text, parse_query_location
)
from app.core.config import settings


class GoogleMapsScraper:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.timeout = settings.SCRAPER_TIMEOUT
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *args):
        await self.stop()

    async def start(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--lang=pt-BR,pt;q=0.9",
            ],
        )
        self.context = await self.browser.new_context(
            user_agent=get_random_user_agent(),
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
            viewport={"width": 1366, "height": 768},
            extra_http_headers={
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            },
        )
        # Mask automation
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        """)
        logger.info("Playwright browser started")

    async def stop(self):
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Playwright browser stopped")

    async def scrape_query(
        self,
        query: str,
        max_results: int = 1000,
        progress_callback: Optional[Callable] = None,
    ) -> List[Dict[str, Any]]:
        """
        Main scraping method. Searches Google Maps and extracts all businesses.
        """
        results = []
        location_data = parse_query_location(query)
        logger.info(f"Starting scrape: '{query}' (max: {max_results})")

        page = await self.context.new_page()
        try:
            # Navigate to Google Maps with the search query
            search_url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}/"
            logger.info(f"Navigating to: {search_url}")
            await page.goto(search_url, wait_until="domcontentloaded", timeout=self.timeout)
            await human_delay(500, 1000)

            # Handle consent popup if present
            await self._handle_consent(page)

            # Scroll through results and collect listing links
            listing_urls = await self._collect_listing_urls(page, max_results, progress_callback)
            logger.info(f"Found {len(listing_urls)} listings to scrape")

            # Scrape listings with 2 parallel pages for ~2x throughput
            page2 = await self.context.new_page()
            try:
                urls_page1 = listing_urls[0::2]   # even indices
                urls_page2 = listing_urls[1::2]   # odd indices
                scraped_lock = asyncio.Lock()

                async def scrape_worker(worker_page, urls, worker_id):
                    for url in urls:
                        try:
                            data = await self._scrape_single_listing(worker_page, url, location_data)
                            if data:
                                async with scraped_lock:
                                    results.append(data)
                                    logger.info(
                                        f"[W{worker_id}] [{len(results)}/{len(listing_urls)}] "
                                        f"Scraped: {data.get('nome', 'Unknown')}"
                                    )
                                    if progress_callback:
                                        await progress_callback(
                                            scraped=len(results),
                                            total=len(listing_urls),
                                            current_name=data.get("nome", ""),
                                        )
                            await human_delay(settings.SCRAPER_DELAY_MIN, settings.SCRAPER_DELAY_MAX)
                        except Exception as e:
                            logger.warning(f"[Worker {worker_id}] Error scraping: {e}")

                await asyncio.gather(
                    scrape_worker(page, urls_page1, 1),
                    scrape_worker(page2, urls_page2, 2),
                )
            finally:
                await page2.close()

        except Exception as e:
            logger.error(f"Critical error in scrape_query: {e}")
            raise
        finally:
            await page.close()

        logger.info(f"Scraping complete. Extracted {len(results)} leads.")
        return results

    async def _handle_consent(self, page: Page):
        """Dismiss Google consent dialogs."""
        try:
            consent_selectors = [
                'button[aria-label*="Aceitar"]',
                'button[aria-label*="Accept"]',
                'button[jsname="b3VHJd"]',
                'form[action*="consent"] button',
                '[aria-label="Aceitar tudo"]',
            ]
            for selector in consent_selectors:
                btn = page.locator(selector).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    await human_delay(500, 1000)
                    logger.debug("Consent dialog dismissed")
                    break
        except Exception:
            pass  # No consent dialog

    async def _collect_listing_urls(
        self,
        page: Page,
        max_results: int,
        progress_callback: Optional[Callable] = None,
    ) -> List[str]:
        """Scroll through Maps results panel and collect all listing URLs."""
        urls = []
        seen = set()

        # Wait for results panel
        try:
            await page.wait_for_selector('[role="feed"]', timeout=15000)
        except Exception:
            logger.warning("Results feed not found, trying alternative selectors")
            try:
                await page.wait_for_selector('.Nv2PK', timeout=10000)
            except Exception:
                logger.error("Could not find results panel")
                return urls

        scroll_container = page.locator('[role="feed"]').first
        no_new_results_count = 0
        max_scroll_attempts = 50

        for scroll_attempt in range(max_scroll_attempts):
            if len(urls) >= max_results:
                break

            # Collect current visible results
            items = await page.locator('a[href*="/maps/place/"]').all()
            new_found = 0

            for item in items:
                try:
                    href = await item.get_attribute("href")
                    if href and "/maps/place/" in href and href not in seen:
                        # Clean URL
                        clean_url = re.sub(r"/\?.*$", "", href)
                        if clean_url not in seen:
                            seen.add(clean_url)
                            seen.add(href)
                            urls.append(href)
                            new_found += 1
                except Exception:
                    continue

            logger.debug(f"Scroll {scroll_attempt+1}: {len(urls)} URLs collected")

            # Check if we reached the end
            end_element = page.locator('p.fontBodyMedium:has-text("fim da lista")').first
            if await end_element.is_visible(timeout=500):
                logger.info("Reached end of results list")
                break

            if new_found == 0:
                no_new_results_count += 1
                if no_new_results_count >= 5:
                    logger.info("No new results after 5 scrolls, stopping")
                    break
            else:
                no_new_results_count = 0

            # Scroll down
            try:
                await scroll_container.evaluate("el => el.scrollBy(0, 800)")
            except Exception:
                await page.keyboard.press("End")

            # Only delay when new results were actually found (skip wasted waits at end)
            if new_found > 0:
                await human_delay(500, 700)

        return urls[:max_results]

    async def _scrape_single_listing(
        self, page: Page, url: str, location_data: dict
    ) -> Optional[Dict[str, Any]]:
        """Navigate to a listing page and extract all data."""
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
            await human_delay(200, 400)

            # Wait for business name to load
            try:
                await page.wait_for_selector('h1.DUwDvf, h1[class*="fontHeadlineLarge"], h1', timeout=5000)
            except Exception:
                pass  # proceed anyway; JS eval will handle missing elements gracefully

            data = {
                "nome": None,
                "categoria": location_data.get("nicho"),
                "endereco": None,
                # cidade/estado start as fallback from query; overridden by real address below
                "cidade": location_data.get("cidade") or None,
                "estado": location_data.get("estado") or None,
                "telefone": None,
                "website": None,
                "nota": None,
                "total_reviews": 0,
                "google_maps_url": url,
                "place_id": self._extract_place_id(url),
            }

            # ── ALL FIELDS via single JS evaluate ─────────────────────────────────
            # One round-trip to the browser replaces 15+ sequential is_visible() calls.
            # The q()/qAttr() helpers try the same CSS fallback chains as before.
            try:
                fields = await page.evaluate(r"""
                    () => {
                        function q(selectors) {
                            for (const sel of selectors) {
                                try {
                                    const el = document.querySelector(sel);
                                    if (el) {
                                        const t = (el.innerText || el.textContent || '').trim();
                                        if (t) return t;
                                    }
                                } catch(e) {}
                            }
                            return null;
                        }
                        function qAttr(selectors, attr) {
                            for (const sel of selectors) {
                                try {
                                    const el = document.querySelector(sel);
                                    if (el) {
                                        const v = el.getAttribute(attr);
                                        if (v) return v;
                                    }
                                } catch(e) {}
                            }
                            return null;
                        }

                        const nome = q(['h1.DUwDvf', 'h1[class*="fontHeadlineLarge"]', 'h1']);
                        const categoria = q(['button[jsaction*="category"]']);
                        const endereco = q([
                            '[data-item-id="address"] .Io6YTe',
                            'button[data-item-id="address"] .Io6YTe',
                            'button[data-item-id="address"]',
                            '[data-item-id="address"]'
                        ]);

                        let telefone = q([
                            '[data-item-id*="phone"] .Io6YTe',
                            'button[data-tooltip="Copiar número de telefone"] .Io6YTe',
                            'button[data-tooltip="Copiar número de telefone"]',
                            '[data-item-id*="phone"]'
                        ]);
                        if (telefone) telefone = telefone.replace(/^[^\d(+]+/, '').trim() || null;

                        const website = qAttr([
                            '[data-item-id*="authority"] a',
                            'a[data-item-id="authority"]',
                            'a[href*="http"][data-item-id]'
                        ], 'href');

                        // Rating + reviews via TreeWalker (resilient to CSS class renames)
                        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                        let rating = null, reviews = null, node;
                        while (node = walker.nextNode()) {
                            const t = node.textContent.trim();
                            if (!rating && /^\d[,.]\d$/.test(t)) rating = t;
                            const rm = t.match(/^([\d.]+)\s+avalia/i);
                            if (!reviews && rm) reviews = rm[1].replace(/\./g, '');
                            if (rating && reviews) break;
                        }

                        return { nome, categoria, endereco, telefone, website, rating, reviews };
                    }
                """)
            except Exception as e:
                logger.debug(f"JS field eval failed: {e}")
                fields = {}

            if fields.get("nome"):
                data["nome"] = clean_text(fields["nome"])
            if fields.get("categoria"):
                data["categoria"] = clean_text(fields["categoria"])
            if fields.get("endereco"):
                addr_text = clean_text(fields["endereco"])
                data["endereco"] = addr_text
                city_state = self._parse_city_state(addr_text)
                if city_state:
                    data["cidade"] = city_state.get("cidade") or data["cidade"]
                    data["estado"] = city_state.get("estado") or data["estado"]
            if fields.get("telefone"):
                phone_clean = re.sub(r'^[^0-9(+]+', '', fields["telefone"]).strip()
                if phone_clean:
                    data["telefone"] = phone_clean
            if fields.get("website") and fields["website"].startswith("http"):
                data["website"] = fields["website"]
            if fields.get("rating"):
                try:
                    data["nota"] = float(fields["rating"].replace(",", "."))
                except (ValueError, TypeError):
                    pass
            if fields.get("reviews"):
                try:
                    data["total_reviews"] = int(fields["reviews"])
                except (ValueError, TypeError):
                    pass

            if not data["nome"]:
                logger.warning(f"No name found for URL: {url[:80]}")
                return None

            return data

        except Exception as e:
            logger.warning(f"Error scraping listing: {e}")
            return None

    def _extract_place_id(self, url: str) -> Optional[str]:
        match = re.search(r"ChI[a-zA-Z0-9_-]+", url)
        return match.group(0) if match else None

    def _parse_city_state(self, address: str) -> Optional[dict]:
        """Parse city and state from a Brazilian address string.

        Accepts addresses like:
          'Rua X, 123 - Bairro, Cidade - SP, 00000-000'
        """
        from app.scraper.utils import _ESTADOS_BR

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
