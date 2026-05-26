"""
Website enrichment scraper.
Visits company websites and extracts emails, WhatsApp, and social media.
"""
import asyncio
import httpx
from typing import Optional, Dict, Any, List
from bs4 import BeautifulSoup
from loguru import logger
from app.scraper.utils import (
    extract_emails_from_text,
    extract_whatsapp_from_text,
    extract_instagram,
    extract_facebook,
    extract_linkedin,
    get_random_user_agent,
    human_delay,
)


# Contact-related page paths to check (kept for reference)
CONTACT_PATHS = [
    "/contato", "/contato.html", "/contato.php",
    "/contact", "/contact-us", "/contact.html",
    "/fale-conosco", "/fale-conosco.html",
    "/sobre", "/sobre-nos", "/about", "/about-us",
    "/quem-somos",
]

# Top contact paths fetched in parallel (most common for Brazilian sites)
CONTACT_PATHS_PRIORITY = [
    "/contato", "/contact", "/fale-conosco", "/sobre",
]

HEADERS_BASE = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


class WebsiteScraper:
    def __init__(self, timeout: int = 4):
        self.timeout = timeout

    def _make_headers(self) -> dict:
        return {**HEADERS_BASE, "User-Agent": get_random_user_agent()}

    def _normalize_url(self, url: str) -> str:
        if not url:
            return url
        url = url.strip()
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        return url.rstrip("/")

    async def enrich_lead(self, website: str) -> Dict[str, Any]:
        """
        Main enrichment method. Visits homepage first; only checks contact pages
        if no email was found there (early-exit optimization).
        Returns dict with: email, whatsapp, instagram, facebook, linkedin
        """
        result = {
            "email": None,
            "whatsapp": None,
            "instagram": None,
            "facebook": None,
            "linkedin": None,
        }

        if not website:
            return result

        base_url = self._normalize_url(website)
        all_emails = []
        all_text_content = ""

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                verify=False,
                headers=self._make_headers(),
            ) as client:

                async def _fetch_safe(url: str) -> Optional[str]:
                    try:
                        return await self._fetch_page(client, url)
                    except Exception:
                        return None

                # ── Passo 1: homepage (rápida) ───────────────────────────
                home_content = await _fetch_safe(base_url)
                if home_content:
                    all_text_content += home_content
                    all_emails.extend(extract_emails_from_text(home_content))

                # ── Passo 2: só busca sub-páginas se ainda não achou email ─
                if not all_emails:
                    contact_urls = [f"{base_url}{p}" for p in CONTACT_PATHS_PRIORITY]
                    pages_content = await asyncio.gather(
                        *[_fetch_safe(u) for u in contact_urls],
                        return_exceptions=True,
                    )
                    for content in pages_content:
                        if isinstance(content, (Exception, type(None))):
                            continue
                        all_text_content += f"\n{content}"
                        all_emails.extend(extract_emails_from_text(content))

        except Exception as e:
            logger.debug(f"⚠️  Website scrape failed for {base_url}: {e}")
            return result

        # De-duplicate emails
        seen = set()
        unique_emails = []
        for email in all_emails:
            if email not in seen:
                seen.add(email)
                unique_emails.append(email)

        if unique_emails:
            result["email"] = unique_emails[0]  # Best email (first found)

        # Extract from combined text
        result["whatsapp"] = extract_whatsapp_from_text(all_text_content)
        result["instagram"] = extract_instagram(all_text_content)
        result["facebook"] = extract_facebook(all_text_content)
        result["linkedin"] = extract_linkedin(all_text_content)

        logger.debug(
            f"🔍 {base_url} → email={result['email']}, "
            f"wa={bool(result['whatsapp'])}, ig={bool(result['instagram'])}"
        )
        return result

    async def _fetch_page(self, client: httpx.AsyncClient, url: str) -> Optional[str]:
        """Fetch a page and return cleaned text content."""
        try:
            response = await client.get(url)
            if response.status_code != 200:
                return None

            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return None

            soup = BeautifulSoup(response.text, "lxml")

            # Remove noise
            for tag in soup(["script", "style", "meta", "noscript", "iframe", "svg"]):
                tag.decompose()

            # Get text and also raw HTML for link detection
            text = soup.get_text(separator=" ")

            # Also include raw HTML for href/link extraction (emails in mailto: links)
            raw_html = str(soup)

            # Extract mailto: links
            mailto_emails = []
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"]
                if href.startswith("mailto:"):
                    email = href.replace("mailto:", "").split("?")[0].strip()
                    if email:
                        mailto_emails.append(email)

            combined = f"{text}\n{raw_html}\n{' '.join(mailto_emails)}"
            return combined[:50000]  # Limit size

        except Exception as e:
            logger.debug(f"Fetch failed for {url}: {e}")
            return None


async def enrich_leads_batch(
    leads_data: List[Dict[str, Any]],
    progress_callback=None,
) -> List[Dict[str, Any]]:
    """Enrich a batch of leads concurrently (with rate limiting)."""
    from app.core.config import settings
    scraper = WebsiteScraper()
    enriched = []
    semaphore = asyncio.Semaphore(settings.SCRAPER_ENRICH_CONCURRENCY)

    async def enrich_one(lead: Dict[str, Any], index: int) -> Dict[str, Any]:
        async with semaphore:
            if lead.get("website"):
                try:
                    enrichment = await scraper.enrich_lead(lead["website"])
                    lead.update({k: v for k, v in enrichment.items() if v})
                except Exception as e:
                    logger.warning(f"Enrichment failed for {lead.get('nome', '?')}: {e}")

            if progress_callback:
                await progress_callback(enriched=index + 1, total=len(leads_data))

            return lead

    tasks = [enrich_one(lead, i) for i, lead in enumerate(leads_data)]
    enriched = await asyncio.gather(*tasks)
    return list(enriched)
