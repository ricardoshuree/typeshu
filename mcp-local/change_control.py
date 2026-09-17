# [mcp-local harness] feature: remove-header-injection | plano: 5a458023 | 2026-09-17 11:59:30
# Remover completamente injecao de cabecalho - inject_comment retorna conteudo puro
"""
change_control.py — camada de controle de mudancas do mcp-typeshurelee.

Fluxo:
    1. propose_change(feature, description, files)  -> plano "pending"
    2. approve_change(plan_id)                       -> plano "approved"
    3. write_file(rel_path, content, plan_id, ...)   -> so roda se aprovado

Estado em mcp_state.json, log em mcp_audit.jsonl (ambos em mcp-local/).
"""

import json
import time
import uuid
from pathlib import Path

STATE_FILE = "mcp_state.json"
AUDIT_FILE = "mcp_audit.jsonl"


def _state_path(harness_root: Path) -> Path:
    return harness_root / STATE_FILE


def _audit_path(harness_root: Path) -> Path:
    return harness_root / AUDIT_FILE


def _load_state(harness_root: Path) -> dict:
    p = _state_path(harness_root)
    if not p.exists():
        return {"plans": {}}
    return json.loads(p.read_text(encoding="utf-8"))


def _save_state(harness_root: Path, state: dict) -> None:
    _state_path(harness_root).write_text(
        json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def _append_audit(harness_root: Path, entry: dict) -> None:
    entry = {"ts": time.strftime("%Y-%m-%d %H:%M:%S"), **entry}
    with _audit_path(harness_root).open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def propose_change(harness_root: Path, feature: str, description: str, files: list[str]) -> dict:
    state = _load_state(harness_root)
    plan_id = uuid.uuid4().hex[:8]
    plan = {
        "plan_id": plan_id,
        "feature": feature,
        "description": description,
        "files": files,
        "status": "pending",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "approved_at": None,
        "writes": [],
    }
    state["plans"][plan_id] = plan
    _save_state(harness_root, state)
    _append_audit(harness_root, {"event": "propose", "plan_id": plan_id, "feature": feature, "files": files})
    return plan


def approve_change(harness_root: Path, plan_id: str) -> dict:
    state = _load_state(harness_root)
    plan = state["plans"].get(plan_id)
    if plan is None:
        raise ValueError(f"Plano '{plan_id}' nao encontrado.")
    plan["status"] = "approved"
    plan["approved_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    _save_state(harness_root, state)
    _append_audit(harness_root, {"event": "approve", "plan_id": plan_id})
    return plan


def reject_change(harness_root: Path, plan_id: str) -> dict:
    state = _load_state(harness_root)
    plan = state["plans"].get(plan_id)
    if plan is None:
        raise ValueError(f"Plano '{plan_id}' nao encontrado.")
    plan["status"] = "rejected"
    _save_state(harness_root, state)
    _append_audit(harness_root, {"event": "reject", "plan_id": plan_id})
    return plan


def list_plans(harness_root: Path, status: str | None = None) -> list[dict]:
    state = _load_state(harness_root)
    plans = list(state["plans"].values())
    if status:
        plans = [p for p in plans if p["status"] == status]
    return plans


RESERVED_FILENAMES = {STATE_FILE, AUDIT_FILE}


def check_authorized(harness_root: Path, plan_id: str, rel_path: str) -> dict:
    if Path(rel_path).name in RESERVED_FILENAMES:
        raise ValueError(f"'{rel_path}' e arquivo interno do harness.")
    state = _load_state(harness_root)
    plan = state["plans"].get(plan_id)
    if plan is None:
        raise ValueError(f"Plano '{plan_id}' nao encontrado. Chame propose_change primeiro.")
    if plan["status"] != "approved":
        raise ValueError(f"Plano '{plan_id}' nao esta aprovado (status: {plan['status']}).")
    if rel_path not in plan["files"]:
        raise ValueError(f"Arquivo '{rel_path}' nao esta no escopo do plano '{plan_id}'.")
    return plan


def register_write(harness_root: Path, plan_id: str, rel_path: str) -> None:
    state = _load_state(harness_root)
    state["plans"][plan_id]["writes"].append(
        {"path": rel_path, "at": time.strftime("%Y-%m-%d %H:%M:%S")}
    )
    _save_state(harness_root, state)
    _append_audit(harness_root, {"event": "write", "plan_id": plan_id, "path": rel_path})


def inject_comment(rel_path: str, content: str, feature: str, description: str, plan_id: str) -> str:
    """Sem injecao de cabecalho. Rastreabilidade ja esta no mcp_audit.jsonl."""
    return content
