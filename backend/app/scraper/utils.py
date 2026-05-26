import re
import random
import asyncio
from typing import Optional, List
from loguru import logger


# ================================================
# USER AGENTS POOL
# ================================================
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
]


def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)


async def human_delay(min_ms: int = 1500, max_ms: int = 4000):
    """Simulate human-like delays to avoid detection."""
    delay = random.uniform(min_ms / 1000, max_ms / 1000)
    await asyncio.sleep(delay)


# ================================================
# EMAIL EXTRACTION
# ================================================
EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Emails to ignore (common false positives)
IGNORED_EMAIL_DOMAINS = {
    "sentry.io", "example.com", "domain.com", "email.com",
    "seu-email.com", "seuemail.com", "youremail.com",
    "wixpress.com", "squarespace.com", "shopify.com",
    "wordpress.com", "placeholder.com", "test.com",
    "empresa.com", "email.exemplo.com", "seudominio.com",
    "2x.png", "3x.png", "1x.png",
}

IGNORED_EMAIL_PREFIXES = {
    "noreply", "no-reply", "donotreply", "bounce",
    "mailer-daemon", "postmaster",
}


def extract_emails_from_text(text: str) -> List[str]:
    """Extract valid email addresses from text."""
    if not text:
        return []
    found = EMAIL_PATTERN.findall(text)
    valid = []
    seen = set()
    for email in found:
        email = email.lower().strip().rstrip(".")
        if "@" not in email:
            continue
        parts = email.split("@")
        if len(parts) != 2:
            continue
        local, domain = parts
        if (
            email not in seen
            and domain not in IGNORED_EMAIL_DOMAINS
            and local not in IGNORED_EMAIL_PREFIXES
            and len(email) < 100
            and "." in domain
            and len(domain) > 3
            and len(local) > 1
            and not local.startswith(".")
            and not local.endswith(".")
            # Ignore image URLs that look like emails
            and not any(domain.endswith(ext) for ext in [".png", ".jpg", ".gif", ".svg", ".webp"])
        ):
            seen.add(email)
            valid.append(email)
    return valid


# ================================================
# PHONE / WHATSAPP EXTRACTION
# ================================================
WHATSAPP_PATTERN = re.compile(
    r"""(?:whatsapp|whats|zap|wpp|w\.?a\.?)[\s:]*(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?\d{4}|\d{4})[\s.\-]?\d{4}""",
    re.IGNORECASE,
)


def normalize_phone(phone: str) -> str:
    """Normalize phone number to digits only."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def extract_whatsapp_from_text(text: str) -> Optional[str]:
    """Try to find WhatsApp number in text or URL."""
    # wa.me links
    wa_link = re.search(r"wa\.me/(\d+)", text)
    if wa_link:
        return f"+{wa_link.group(1)}"

    # api.whatsapp.com
    api_link = re.search(r"api\.whatsapp\.com/send\?phone=(\d+)", text)
    if api_link:
        return f"+{api_link.group(1)}"

    # Text mentions
    match = WHATSAPP_PATTERN.search(text)
    if match:
        phone = normalize_phone(match.group())
        if len(phone) >= 10:
            return phone

    return None


# ================================================
# SOCIAL MEDIA EXTRACTION
# ================================================
def extract_instagram(text: str) -> Optional[str]:
    match = re.search(
        r"""(?:https?://)?(?:www\.)?instagram\.com/(?!p/|reel/|stories/|explore/|tv/)([a-zA-Z0-9._]{1,30})/?""",
        text, re.IGNORECASE,
    )
    if match:
        username = match.group(1).rstrip("/")
        if username and username not in {"web", "accounts", "direct", "share"}:
            return f"https://instagram.com/{username}"
    return None


def extract_facebook(text: str) -> Optional[str]:
    match = re.search(
        r"""(?:https?://)?(?:www\.)?facebook\.com/(?!sharer|share|login|photo|dialog)([a-zA-Z0-9._\-]{1,80})/?""",
        text, re.IGNORECASE,
    )
    if match:
        page = match.group(1).rstrip("/")
        if page and len(page) > 2:
            return f"https://facebook.com/{page}"
    return None


def extract_linkedin(text: str) -> Optional[str]:
    match = re.search(
        r"""(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/([a-zA-Z0-9._\-]{1,80})/?""",
        text, re.IGNORECASE,
    )
    if match:
        slug = match.group(1).rstrip("/")
        return f"https://linkedin.com/company/{slug}"
    return None


# ================================================
# TEXT UTILS
# ================================================
def clean_text(text: str) -> str:
    """Clean text: strip leading emoji/icon chars and normalize whitespace."""
    if not text:
        return ""
    # Strip leading Unicode symbol/emoji characters (Google Maps icons like 📍📞🌐)
    # Category codes: So=Symbol-Other, Sm=Symbol-Math, Sk=Symbol-Modifier, Cn=Unassigned
    # Cc=Control, Cf=Format, Cs=Surrogate, Co=Private-Use
    import unicodedata
    stripped = text.lstrip()
    while stripped:
        cat = unicodedata.category(stripped[0])
        if cat.startswith(('S', 'C')) and stripped[0] not in ('+', '-', '(', ')'):
            stripped = stripped[1:].lstrip()
        else:
            break
    return " ".join(stripped.split()).strip()


# Valid Brazilian state codes
_ESTADOS_BR = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}


def parse_query_location(query: str) -> dict:
    """Parse 'academias em campinas sp' into components.

    Pattern 1 only accepts a 2-letter state code if it is a valid
    Brazilian UF abbreviation — avoids false-positives like 'as' in 'campinas'.
    """
    result = {"nicho": "", "cidade": "", "estado": "", "query": query}

    q = query.strip()

    # Pattern 1: "nicho em cidade ST" — state must be uppercase & valid
    m = re.match(r"^(.+?)\s+[Ee][Mm]\s+(.+?)\s*,?\s*([A-Za-z]{2})$", q)
    if m and m.group(3).upper() in _ESTADOS_BR:
        result["nicho"] = m.group(1).strip().title()
        result["cidade"] = m.group(2).strip().title()
        result["estado"] = m.group(3).strip().upper()
        return result

    # Pattern 2: "nicho em cidade"
    m = re.match(r"^(.+?)\s+[Ee][Mm]\s+(.+)$", q)
    if m:
        result["nicho"] = m.group(1).strip().title()
        result["cidade"] = m.group(2).strip().title()
        return result

    # Pattern 3: just a nicho
    result["nicho"] = q.title()
    return result
