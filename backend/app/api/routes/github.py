"""
GitHub integration routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.api.deps import get_current_user
from app.models.user import User
import app.services.github_service as gh

router = APIRouter(prefix="/github", tags=["github"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    token: str

class CreateRepoRequest(BaseModel):
    name: str
    private: bool = True
    description: Optional[str] = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def github_status(current_user: User = Depends(get_current_user)):
    return gh.get_status()


@router.post("/connect")
async def github_connect(
    data: ConnectRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        user_info = await gh.validate_token(data.token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao conectar ao GitHub: {e}")

    cfg = gh.load_config()
    cfg["token"]      = data.token
    cfg["username"]   = user_info["login"]
    cfg["avatar_url"] = user_info["avatar_url"]
    gh.save_config(cfg)

    return {
        "connected":  True,
        "username":   user_info["login"],
        "avatar_url": user_info["avatar_url"],
        "name":       user_info["name"],
    }


@router.delete("/disconnect")
async def github_disconnect(current_user: User = Depends(get_current_user)):
    from app.services.github_service import _default_config, save_config
    save_config(_default_config())
    return {"disconnected": True}


@router.get("/repos")
async def github_repos(current_user: User = Depends(get_current_user)):
    cfg = gh.load_config()
    if not cfg.get("token"):
        raise HTTPException(status_code=400, detail="GitHub não conectado.")
    try:
        repos = await gh.list_repos(cfg["token"])
        return {"repos": repos}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao listar repositórios: {e}")


@router.post("/create-repo")
async def github_create_repo(
    data: CreateRepoRequest,
    current_user: User = Depends(get_current_user),
):
    cfg = gh.load_config()
    if not cfg.get("token"):
        raise HTTPException(status_code=400, detail="GitHub não conectado.")

    try:
        repo_info = await gh.create_repo(
            token=cfg["token"],
            name=data.name,
            private=data.private,
            description=data.description or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao criar repositório: {e}")

    cfg["repo_name"] = repo_info["name"]
    cfg["repo_url"]  = repo_info["html_url"]
    gh.save_config(cfg)

    return repo_info


@router.post("/push")
async def github_push(current_user: User = Depends(get_current_user)):
    cfg = gh.load_config()
    if not cfg.get("token"):
        raise HTTPException(status_code=400, detail="GitHub não conectado.")
    if not cfg.get("repo_name"):
        raise HTTPException(status_code=400, detail="Nenhum repositório configurado.")

    token     = cfg["token"]
    username  = cfg["username"]
    repo_name = cfg["repo_name"]

    try:
        from pathlib import Path
        from app.services.github_service import _is_git_repo, PROJECT_ROOT, git_init_and_push, git_push_update

        if not _is_git_repo(PROJECT_ROOT) or not cfg.get("initialized"):
            log = git_init_and_push(token, username, repo_name)
            cfg["initialized"] = True
        else:
            log = git_push_update(token, username, repo_name)

        from datetime import datetime
        cfg["last_push"] = datetime.now().isoformat()
        gh.save_config(cfg)

        return {"success": True, "log": log}

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {e}")
