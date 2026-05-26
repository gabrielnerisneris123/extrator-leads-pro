"""
GitHub integration service.
Handles token validation, repo creation, and git push via subprocess.
"""
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

# ── Paths ────────────────────────────────────────────────────────────────────
# backend/app/services/github_service.py → go up 4 levels → project root
_SERVICE_DIR  = Path(__file__).parent          # services/
_BACKEND_DIR  = _SERVICE_DIR.parent.parent     # backend/
PROJECT_ROOT  = _BACKEND_DIR.parent            # Extrator Leads/
CONFIG_FILE   = _BACKEND_DIR / "github_config.json"

GITHUB_API    = "https://api.github.com"
HEADERS_BASE  = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


# ── Config persistence ────────────────────────────────────────────────────────

def _default_config() -> Dict[str, Any]:
    return {
        "token":       "",
        "username":    "",
        "avatar_url":  "",
        "repo_name":   "",
        "repo_url":    "",
        "initialized": False,
        "last_push":   None,
    }


def load_config() -> Dict[str, Any]:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return _default_config()


def save_config(cfg: Dict[str, Any]) -> None:
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")


# ── GitHub API helpers ────────────────────────────────────────────────────────

def _auth_headers(token: str) -> dict:
    return {**HEADERS_BASE, "Authorization": f"Bearer {token}"}


async def validate_token(token: str) -> Dict[str, Any]:
    """Validates PAT and returns user info {login, avatar_url, name}."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{GITHUB_API}/user", headers=_auth_headers(token))
        if resp.status_code == 401:
            raise ValueError("Token inválido ou expirado.")
        resp.raise_for_status()
        data = resp.json()
        return {
            "login":      data["login"],
            "avatar_url": data.get("avatar_url", ""),
            "name":       data.get("name") or data["login"],
        }


async def list_repos(token: str) -> List[Dict[str, Any]]:
    """Lists user repos (up to 100, sorted by updated)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{GITHUB_API}/user/repos",
            headers=_auth_headers(token),
            params={"per_page": 100, "sort": "updated", "affiliation": "owner"},
        )
        resp.raise_for_status()
        return [
            {
                "id":        r["id"],
                "name":      r["name"],
                "full_name": r["full_name"],
                "private":   r["private"],
                "html_url":  r["html_url"],
            }
            for r in resp.json()
        ]


async def create_repo(
    token: str,
    name: str,
    private: bool = True,
    description: str = "",
) -> Dict[str, Any]:
    """Creates a new GitHub repository and returns its info."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GITHUB_API}/user/repos",
            headers=_auth_headers(token),
            json={
                "name":        name,
                "description": description or "Gerado pelo Extrator Leads Pro",
                "private":     private,
                "auto_init":   False,
            },
        )
        if resp.status_code == 422:
            detail = resp.json().get("message", "Repositório já existe ou nome inválido.")
            raise ValueError(detail)
        resp.raise_for_status()
        data = resp.json()
        return {
            "name":      data["name"],
            "full_name": data["full_name"],
            "html_url":  data["html_url"],
            "clone_url": data["clone_url"],
            "private":   data["private"],
        }


# ── Git operations (subprocess) ───────────────────────────────────────────────

def _run_git(args: List[str], cwd: Path, env_token: Optional[str] = None) -> str:
    """Runs a git command, returns combined stdout+stderr output."""
    cmd = ["git"] + args
    env = None

    # Set credential helper so token is used inline
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    output = (result.stdout or "") + (result.stderr or "")
    logger.debug(f"git {' '.join(args)} → rc={result.returncode}\n{output.strip()}")
    if result.returncode != 0:
        raise RuntimeError(output.strip())
    return output.strip()


def _ensure_gitignore(root: Path) -> None:
    """Creates .gitignore at project root if it doesn't exist."""
    gi = root / ".gitignore"
    if gi.exists():
        return
    content = """# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/

# Virtual environment
backend/venv/
venv/
.venv/

# Database
backend/leads.db
*.db
*.sqlite3

# Environment secrets (NEVER commit these)
backend/.env
frontend/.env.local
.env
.env.local
.env.*

# GitHub config (contains token)
backend/github_config.json

# Logs
backend/logs/
*.log
backend/uvicorn_out.txt
backend/uvicorn_err.txt

# Next.js
frontend/.next/
frontend/out/
frontend/node_modules/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
"""
    gi.write_text(content, encoding="utf-8")
    logger.info(f".gitignore criado em {gi}")


def _is_git_repo(root: Path) -> bool:
    return (root / ".git").is_dir()


def _remote_exists(root: Path) -> bool:
    try:
        out = _run_git(["remote"], root)
        return "origin" in out
    except Exception:
        return False


def git_init_and_push(token: str, username: str, repo_name: str) -> str:
    """
    Full first-time push:
    git init → .gitignore → add → commit → remote add → push
    Returns combined log output.
    """
    root = PROJECT_ROOT
    _ensure_gitignore(root)
    log_lines: List[str] = []

    def step(label: str, args: List[str]) -> None:
        log_lines.append(f"$ git {' '.join(args)}")
        out = _run_git(args, root)
        if out:
            log_lines.append(out)

    try:
        if not _is_git_repo(root):
            step("init", ["init"])
            step("branch", ["checkout", "-b", "main"])
        else:
            log_lines.append("Repositório git já inicializado.")

        step("add", ["add", "."])

        # Check if there's anything to commit
        status = _run_git(["status", "--porcelain"], root)
        if status.strip():
            step("commit", ["commit", "-m", "feat: initial commit — Extrator Leads Pro"])
        else:
            log_lines.append("Nada novo para commitar.")

        remote_url = f"https://{token}@github.com/{username}/{repo_name}.git"

        if _remote_exists(root):
            # Update existing remote URL (token may have changed)
            _run_git(["remote", "set-url", "origin", remote_url], root)
            log_lines.append("Remote 'origin' atualizado.")
        else:
            step("remote", ["remote", "add", "origin", remote_url])

        step("push", ["push", "-u", "origin", "main", "--force"])

        log_lines.append("")
        log_lines.append(f"✅ Código publicado em https://github.com/{username}/{repo_name}")
        return "\n".join(log_lines)

    except RuntimeError as e:
        log_lines.append(f"\n❌ Erro: {e}")
        raise RuntimeError("\n".join(log_lines)) from e


def git_push_update(token: str, username: str, repo_name: str) -> str:
    """
    Incremental push (repo already initialized):
    git add → commit → push
    """
    root = PROJECT_ROOT
    _ensure_gitignore(root)
    log_lines: List[str] = []

    def step(label: str, args: List[str]) -> None:
        log_lines.append(f"$ git {' '.join(args)}")
        out = _run_git(args, root)
        if out:
            log_lines.append(out)

    try:
        step("add", ["add", "."])

        status = _run_git(["status", "--porcelain"], root)
        if not status.strip():
            log_lines.append("Nenhuma alteração desde o último push.")
            return "\n".join(log_lines)

        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        step("commit", ["commit", "-m", f"chore: update — {ts}"])

        # Ensure remote URL has current token
        remote_url = f"https://{token}@github.com/{username}/{repo_name}.git"
        _run_git(["remote", "set-url", "origin", remote_url], root)

        step("push", ["push", "origin", "main"])

        log_lines.append("")
        log_lines.append(f"✅ Push concluído em {ts}")
        return "\n".join(log_lines)

    except RuntimeError as e:
        log_lines.append(f"\n❌ Erro: {e}")
        raise RuntimeError("\n".join(log_lines)) from e


# ── Status ────────────────────────────────────────────────────────────────────

def get_status() -> Dict[str, Any]:
    cfg = load_config()
    return {
        "connected":    bool(cfg.get("token")),
        "username":     cfg.get("username", ""),
        "avatar_url":   cfg.get("avatar_url", ""),
        "repo_name":    cfg.get("repo_name", ""),
        "repo_url":     cfg.get("repo_url", ""),
        "initialized":  cfg.get("initialized", False) and _is_git_repo(PROJECT_ROOT),
        "last_push":    cfg.get("last_push"),
        "project_root": str(PROJECT_ROOT),
    }
