import time
import sqlite3
import yaml
from pathlib import Path
from fastmcp import FastMCP
import change_control as cc

cfg = yaml.safe_load(Path(__file__).parent.joinpath("config.yaml").read_text())
ROOT = Path(cfg["root_path"]).resolve()
ALLOWED_EXT = set(cfg.get("allowed_extensions", []))
BLOCKED = set(cfg.get("blocked_dirs", []))
HARNESS_ROOT = Path(__file__).parent.resolve()

# ── Telemetria SQLite ──────────────────────────────────────────────────────────
_TELEM_DIR = HARNESS_ROOT / "monitor"
_TELEM_DB  = _TELEM_DIR / "tool_calls.db"

def _init_telem():
    _TELEM_DIR.mkdir(exist_ok=True)
    con = sqlite3.connect(str(_TELEM_DB))
    con.execute(
        "CREATE TABLE IF NOT EXISTS tool_calls "
        "(id INTEGER PRIMARY KEY AUTOINCREMENT, "
        " ts REAL NOT NULL, "
        " tool TEXT NOT NULL, "
        " dur_ms REAL NOT NULL, "
        " ok INTEGER NOT NULL)"
    )
    con.commit()
    con.close()

def _record_call(tool: str, dur_ms: float, ok: bool):
    try:
        con = sqlite3.connect(str(_TELEM_DB), timeout=2)
        con.execute(
            "INSERT INTO tool_calls (ts, tool, dur_ms, ok) VALUES (?, ?, ?, ?)",
            (time.time(), tool, round(dur_ms, 1), int(ok))
        )
        con.commit()
        con.close()
    except Exception:
        pass

_init_telem()

# ── MCP server ─────────────────────────────────────────────────────────────────
mcp = FastMCP(cfg["project_name"])


def _safe_path(rel_path: str) -> Path:
    p = (ROOT / rel_path).resolve()
    if not str(p).startswith(str(ROOT)):
        raise ValueError("Caminho fora do escopo do projeto")
    if any(b in p.parts for b in BLOCKED):
        raise ValueError("Diretorio bloqueado")
    return p


def _timed(tool_name: str, fn):
    t0 = time.perf_counter()
    ok = True
    try:
        result = fn()
        return result
    except Exception:
        ok = False
        raise
    finally:
        _record_call(tool_name, (time.perf_counter() - t0) * 1000, ok)


@mcp.tool
def read_file(rel_path: str) -> str:
    """Le o conteudo de um arquivo do projeto."""
    return _timed("read_file", lambda: _safe_path(rel_path).read_text(encoding="utf-8"))


@mcp.tool
def list_dir(rel_path: str = ".") -> list[str]:
    """Lista arquivos e pastas dentro do projeto."""
    def _run():
        p = _safe_path(rel_path)
        return [str(f.relative_to(ROOT)) for f in p.iterdir()]
    return _timed("list_dir", _run)


@mcp.tool
def propose_change(feature: str, description: str, files: list[str]) -> dict:
    """Primeiro passo, obrigatorio antes de qualquer write_file.
    Declare a feature, descricao e lista de paths que serao modificados.
    Retorna um plano com plan_id para ser aprovado."""
    return _timed("propose_change", lambda: cc.propose_change(HARNESS_ROOT, feature, description, files))


@mcp.tool
def approve_change(plan_id: str, action: str = "approve") -> dict:
    """Gerencia um plano pelo plan_id.
    action='approve'  -> aprova o plano, liberando write_file (padrao).
    action='reject'   -> rejeita/cancela o plano.
    action='list'     -> lista planos; plan_id vira filtro de status
                         ('pending', 'approved', 'rejected') ou 'all'.
    So aprove depois de confirmacao explicita do usuario na conversa."""
    def _run():
        if action == "reject":
            return cc.reject_change(HARNESS_ROOT, plan_id)
        if action == "list":
            status = plan_id if plan_id in ("pending", "approved", "rejected") else "pending"
            return cc.list_plans(HARNESS_ROOT, status)
        return cc.approve_change(HARNESS_ROOT, plan_id)
    return _timed("approve_change", _run)


@mcp.tool
def write_file(rel_path: str, content: str, plan_id: str, feature: str, description: str) -> str:
    """Escreve/sobrescreve um arquivo do projeto.
    Requer plan_id ja aprovado via propose_change + approve_change.
    O conteudo recebe um comentario de rastreabilidade no topo automaticamente."""
    def _run():
        cc.check_authorized(HARNESS_ROOT, plan_id, rel_path)
        p = _safe_path(rel_path)
        if p.suffix and p.suffix not in ALLOWED_EXT:
            raise ValueError(f"Extensao nao permitida: {p.suffix}")
        final_content = cc.inject_comment(rel_path, content, feature, description, plan_id)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(final_content, encoding="utf-8")
        cc.register_write(HARNESS_ROOT, plan_id, rel_path)
        return f"Arquivo salvo: {rel_path} (plano {plan_id})"
    return _timed("write_file", _run)


if __name__ == "__main__":
    mcp.run()
