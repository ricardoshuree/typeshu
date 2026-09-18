# [mcp-local harness] feature: monitor-fstring-fix | plano: 152e10f8 | 2026-09-18 05:41
# Fix SyntaxError: backslash em f-string (Python < 3.12) — pre-computa variaveis
"""
monitor_mcp.py - TypeShu MCP Monitor
Uso:
  python monitor_mcp.py             -> roda no terminal atual
  python monitor_mcp.py --terminal  -> abre em nova janela PowerShell
  Encerrar: Ctrl+C

Fica na RAIZ do projeto (C:\\project-claude\\typeshurelee\\).

Fontes de dados:
  - mcp-local/monitor/tool_calls.db  -> duracao (ms) e status ok/erro por chamada
  - mcp-local/mcp_audit.jsonl        -> feature e path por operacao

Paleta de cores:
  Verde  (#52FF52) — rapido  / menor do historico  (ms < 50)
  Amarelo(#FFE000) — normal  / medio do historico  (ms < 200)
  Laranja(#FF8C00) — lento   / maior do historico  (ms >= 200)
  Vermelho(#DC3C3C)— erro / offline
  Sparkline: relativo ao historico (sempre tem variacao visual)
  Barras/ms: absoluto (<50 verde, <200 amarelo, >=200 laranja)
"""
from __future__ import annotations
import sys, os, time, threading, re, json, sqlite3, subprocess, tempfile
from pathlib import Path
from datetime import datetime
from collections import deque

# -- --terminal: grava .ps1 temporario e lanca com Start-Process --------------
if "--terminal" in sys.argv:
    script = Path(__file__).resolve()
    python = Path(sys.executable).resolve()
    root   = script.parent

    ps_content = (
        f'$host.UI.RawUI.WindowTitle = "TypeShu Monitor"\r\n'
        f'Set-Location "{root}"\r\n'
        f'& "{python}" "{script}"\r\n'
        f'Read-Host "Pressione Enter para fechar"\r\n'
    )
    tmp = Path(tempfile.gettempdir()) / "typeshurelee_monitor.ps1"
    tmp.write_text(ps_content, encoding="utf-8")

    subprocess.Popen([
        "powershell",
        "-ExecutionPolicy", "Bypass",
        "-File", str(tmp),
    ], creationflags=0x00000010)
    sys.exit(0)
# -----------------------------------------------------------------------------

if sys.platform == "win32":
    try:
        import ctypes
        k = ctypes.windll.kernel32
        k.SetConsoleMode(k.GetStdHandle(-11), 7)
    except Exception:
        pass

ROOT        = Path(__file__).parent
AUDIT_FILE  = ROOT / "mcp-local" / "mcp_audit.jsonl"
TELEM_DB    = ROOT / "mcp-local" / "monitor" / "tool_calls.db"

# ── Paleta RGB direto ─────────────────────────────────────────────────────────
_R   = "\033[0m"
_G   = "\x1b[38;2;82;255;82m"      # verde    — rapido / menor
_YL  = "\x1b[38;2;255;224;0m"      # amarelo  — normal / medio
_AM  = "\x1b[38;2;255;140;0m"      # laranja  — lento  / maior
_RD  = "\x1b[38;2;220;60;60m"      # vermelho — erro / offline
_DIM = "\x1b[2m"
_BD  = "\x1b[1m"
_GR  = "\x1b[38;2;100;100;100m"    # cinza    — vazio / dim
_CY  = "\x1b[38;2;40;180;255m"     # ciano    — generico
_BL  = "\x1b[38;2;100;160;255m"    # azul     — feature name
_PU  = "\x1b[38;2;180;140;255m"    # roxo     — titulo

# Caracteres Unicode pre-definidos (evita backslash em f-string, Python < 3.12)
_BLK  = "\u2588"   # bloco cheio
_SHAD = "\u2591"   # bloco vazio/sombra
_DASH = "\u2500"   # traco horizontal
_BAR7 = "\u2587"   # bloco 7/8 (para legenda)
# ─────────────────────────────────────────────────────────────────────────────

_PING_INTERVAL = 3.0
_HIST_W   = 80
_LINE_W   = 120
_BAR_W    = 22
_PATH_W   = 50
_ROWS     = 22
_BLOCKS   = " \u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588"
_ANSI_RE  = re.compile(r'\x1b\[[0-9;]*m')
_JOIN_WIN = 2.0

_EVENT_LABEL = {
    "propose": "propose_change",
    "approve": "approve_change",
    "write":   "write_file",
    "read":    "read_file",
    "list":    "list_dir",
    "reject":  "reject_change",
}

_OP_COLOR = {
    "propose_change": _BL,
    "approve_change": _G,
    "write_file":     _YL,
    "read_file":      _DIM,
    "list_dir":       _GR,
    "reject_change":  _RD,
}

_EXT_ICON = {
    "py":   "PY",
    "ts":   "TS", "tsx": "TS",
    "js":   "JS", "jsx": "JS",
    "md":   "MD",
    "json": "{}",
    "css":  "CS", "scss": "CS",
    "html": "HT",
    "yaml": "YM", "yml": "YM",
    "toml": "TM",
}


def _vlen(s): return len(_ANSI_RE.sub("", s))
def _pad(s, w): return s + " " * max(0, w - _vlen(s))


class MCPStatus:
    def __init__(self):
        self.alive        = False
        self.pid          = None
        self.lat_ms       = None
        self.uptime_start = None
        self.instancias   = 0
        self.history      = deque([None] * _HIST_W, maxlen=_HIST_W)
        self.lock         = threading.Lock()

    def lat_str(self):
        if self.lat_ms is None:
            return f"{_RD}offline{_R}"
        c = _G if self.lat_ms < 4 else (_YL if self.lat_ms < 7 else _AM)
        return f"{c}{self.lat_ms:>5.0f} ms{_R}"

    def uptime_str(self):
        if self.uptime_start is None:
            return "-"
        s = int(time.time() - self.uptime_start)
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        if h: return f"{h}h{m:02d}m"
        if m: return f"{m}m{sec:02d}s"
        return f"{sec}s"

    def pid_str(self):
        return f"PID {self.pid}" if self.pid else "PID -"


def _ping_process(s: MCPStatus):
    try:
        import psutil
    except ImportError:
        return

    marcadores = ["mcp-typeshurelee", "typeshurelee\\mcp-local", "typeshurelee/mcp-local"]
    procs = []
    for proc in psutil.process_iter(["pid", "name", "cmdline", "create_time"]):
        try:
            info = proc.info
            nome = (info.get("name") or "").lower()
            if "python" not in nome and "uv" not in nome:
                continue
            cmd = " ".join(info.get("cmdline") or []).lower().replace("\\", "/")
            if any(m.lower().replace("\\", "/") in cmd for m in marcadores):
                procs.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    with s.lock:
        s.instancias = len(procs)
        if procs:
            p = procs[0]
            s.pid = p.pid
            t0  = time.perf_counter()
            _   = p.status()
            lat = (time.perf_counter() - t0) * 1000
            if s.uptime_start is None:
                s.uptime_start = p.info["create_time"]
            s.alive  = True
            s.lat_ms = lat
            s.history.append(lat)
        else:
            s.pid = s.lat_ms = s.uptime_start = None
            s.alive = False
            s.history.append(None)


def _poll(s: MCPStatus):
    while True:
        _ping_process(s)
        time.sleep(_PING_INTERVAL)


def _hist(history, width):
    """Sparkline com cor RELATIVA ao historico.
    norm < 0.4 = verde, < 0.7 = amarelo, >= 0.7 = laranja.
    Sempre tem variacao visual mesmo quando todas as latencias sao baixas.
    """
    items = list(history)[-width:]
    valid = [v for v in items if v is not None]
    if not valid:
        return _GR + (_DASH * width) + _R

    mn  = min(valid)
    mx  = max(valid)
    rng = max(mx - mn, 1.0)

    out = []
    for v in items:
        if v is None:
            out.append(f"{_RD}{_DASH}{_R}")
        else:
            norm = (v - mn) / rng
            idx  = max(1, min(8, int(norm * 7) + 1))
            col  = _G if norm < 0.4 else (_YL if norm < 0.7 else _AM)
            out.append(f"{col}{_BLOCKS[idx]}{_R}")
    return "".join(out)


def _dur_bar(dur_ms, max_ms, width=_BAR_W):
    """Barra de duracao com cor ABSOLUTA.
    < 4ms = verde, < 7ms = amarelo, >= 7ms = laranja.
    """
    if max_ms <= 0:
        max_ms = 1
    ratio  = min(dur_ms / max_ms, 1.0)
    filled = max(1, int(ratio * width))
    empty  = width - filled
    c      = _G if dur_ms < 4 else (_YL if dur_ms < 7 else _AM)
    # Pre-computa strings para evitar backslash em f-string (Python < 3.12)
    filled_str = _BLK * filled
    empty_str  = _SHAD * empty
    return f"{c}{filled_str}{_R}{_GR}{empty_str}{_R}"


def _read_telem(n=_ROWS * 2):
    if not TELEM_DB.exists():
        return []
    try:
        con = sqlite3.connect(str(TELEM_DB), timeout=1)
        con.row_factory = sqlite3.Row
        rows = con.execute(
            "SELECT ts, tool, dur_ms, ok FROM tool_calls ORDER BY id DESC LIMIT ?", (n,)
        ).fetchall()
        con.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def _read_audit(n=_ROWS * 3):
    if not AUDIT_FILE.exists():
        return []
    try:
        linhas = AUDIT_FILE.read_text(encoding="utf-8").splitlines()
        entries = []
        for ln in linhas:
            ln = ln.strip()
            if not ln:
                continue
            try:
                entries.append(json.loads(ln))
            except Exception:
                pass
        return entries[-n:]
    except Exception:
        return []


def _audit_ts_float(e):
    raw = str(e.get("ts") or e.get("timestamp") or e.get("created_at") or "0")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except Exception:
        try:
            return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").timestamp()
        except Exception:
            return 0.0


def _unified_rows(n=_ROWS):
    telem = _read_telem(n * 2)
    audit = _read_audit(n * 3)

    audit_with_ts = []
    for e in audit:
        raw_ev = e.get("event") or e.get("action") or e.get("tool") or ""
        op     = _EVENT_LABEL.get(raw_ev, raw_ev)
        audit_with_ts.append({
            "ts":      _audit_ts_float(e),
            "op":      op,
            "feature": e.get("feature") or "",
            "path":    e.get("path") or e.get("rel_path") or e.get("file") or "",
        })

    used_audit = set()
    rows = []
    for t in telem[:n]:
        tool = t["tool"]
        ts   = t["ts"]
        best_idx  = None
        best_diff = _JOIN_WIN + 1
        for i, a in enumerate(audit_with_ts):
            if i in used_audit:
                continue
            if a["op"] != tool:
                continue
            diff = abs(a["ts"] - ts)
            if diff < best_diff:
                best_diff = diff
                best_idx  = i

        feature = path = ""
        if best_idx is not None:
            used_audit.add(best_idx)
            feature = audit_with_ts[best_idx]["feature"]
            path    = audit_with_ts[best_idx]["path"]

        rows.append({
            "ts":      ts,
            "tool":    tool,
            "dur_ms":  t["dur_ms"],
            "ok":      bool(t["ok"]),
            "feature": feature,
            "path":    path,
        })

    return rows


def _short_path(path, max_w=_PATH_W):
    p = path.replace("\\", "/")
    if len(p) > max_w:
        p = "..." + p[-(max_w - 3):]
    return p


def _file_icon(path):
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return _EXT_ICON.get(ext, "  ")


def _render_calls(rows):
    if not rows:
        return [f"  {_DIM}(nenhuma chamada registrada ainda){_R}"]

    max_ms = max((r["dur_ms"] for r in rows), default=1) or 1
    lines = []
    for r in rows:
        ts_str  = datetime.fromtimestamp(r["ts"]).strftime("%H:%M:%S")
        ok_mark = f"{_G}ok{_R}" if r["ok"] else f"{_RD}er{_R}"
        tool    = r["tool"]
        dur     = r["dur_ms"]
        feat    = r["feature"]
        path    = r["path"]

        c_op  = _OP_COLOR.get(tool, _CY)
        c_dur = _G if dur < 4 else (_YL if dur < 7 else _AM)
        bar   = _dur_bar(dur, max_ms)

        l1 = (
            f"  {_DIM}{ts_str}{_R}  "
            f"{ok_mark}  "
            f"{c_op}{tool:<16}{_R}  "
            f"{c_dur}{dur:>6.1f} ms{_R}  "
            f"{bar}"
        )
        if feat:
            l1 += f"  {_BL}{feat}{_R}"
        if path:
            short = _short_path(path)
            icon  = _file_icon(path)
            l1 += f"  {_GR}[{icon}] {short}{_R}"

        lines.append(l1)

    return lines


def _legend_calls():
    db_ok = TELEM_DB.exists()
    jl_ok = AUDIT_FILE.exists()
    db_st = f"{_G}ok{_R}" if db_ok else f"{_RD}ausente{_R}"
    jl_st = f"{_G}ok{_R}" if jl_ok else f"{_RD}ausente{_R}"
    return (
        f"{_R}{_DIM}  {'.' * (_LINE_W - 4)}{_R}\n"
        f"  {_DIM}tool calls: banco {db_st}  "
        f"ok=sucesso  er=erro  "
        f"{_G}{_BLK}{_R}{_DIM}=rapido(<4ms)  "
        f"{_YL}{_BLK}{_R}{_DIM}=normal(<7ms)  "
        f"{_AM}{_BLK}{_R}{_DIM}=lento(>=7ms)  "
        f"{_GR}{_SHAD}{_R}{_GR}=vazio{_R}  audit: {jl_st}"
    )


def _mcp_block(s):
    dot = f"{_G}[ON]{_R}" if s.alive else f"{_RD}[OFF]{_R}"
    lc  = _G if s.alive else _RD
    h   = _hist(s.history, _HIST_W)
    dup = f"  {_AM}!! {s.instancias} instancias{_R}" if s.instancias > 1 else ""

    l1 = f"  {dot} {_PU}{_BD}MCP-TYPESHURELEE{_R}  {h}{dup}"
    l2 = (
        f"       {_DIM}{'-' * 16}{_R}  "
        f"{lc}{s.lat_str():>8}{_R}  "
        f"{_DIM}up {s.uptime_str():<10}{_R}  "
        f"{_GR}{s.pid_str()}{_R}"
    )
    return [l1, l2]


def _legend_ping():
    return [
        f"  {_DIM}ping: cada bloco = {_PING_INTERVAL:.0f}s  "
        f"{_G}{_BAR7}{_R}{_DIM}=menor  "
        f"{_YL}{_BAR7}{_R}{_DIM}=medio  "
        f"{_AM}{_BAR7}{_R}{_DIM}=maior do historico  "
        f"{_RD}{_DASH}{_R}{_DIM}=offline{_R}",
        f"  {_AM}!! N instancias{_R}{_DIM} = multiplos processos server.py rodando "
        f"(reinicie o MCP){_R}",
    ]


def _sep(c="-"):
    return f"  {_GR}{c * (_LINE_W - 4)}{_R}"


def _header():
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    return f"  {_PU}{_BD}TypeShu - MCP Monitor{_R}  {_DIM}{now}{_R}"


def _build(s):
    rows  = _unified_rows(_ROWS)
    lines = []
    lines.append(_sep("="))
    lines.append(_header())
    lines.append(_sep())
    lines += _mcp_block(s)
    lines.append("")
    lines += _legend_ping()
    lines.append(_sep())

    n  = len(rows)
    h2 = f"  {_BD}TOOL CALLS{_R}"
    if n:
        h2 += f"  {_DIM}ultimas {n}{_R}"
    lines.append(h2)
    lines.append(_sep("."))
    lines += _render_calls(rows)
    lines.append(_legend_calls())
    lines.append(_sep("="))
    return lines


def _render_loop(s):
    while True:
        panel = _build(s)
        os.system("cls" if sys.platform == "win32" else "clear")
        sys.stdout.write("\n".join(panel) + "\n")
        sys.stdout.flush()
        time.sleep(_PING_INTERVAL)


def main():
    try:
        import psutil  # noqa: F401
    except ImportError:
        print("[ERRO] psutil nao instalado. Execute: pip install psutil")
        sys.exit(1)

    sys.stdout.write("\033]0;monitor_mcp - TypeShu\007")
    sys.stdout.flush()
    os.system("cls" if sys.platform == "win32" else "clear")

    s = MCPStatus()
    threading.Thread(target=_poll, args=(s,), daemon=True).start()

    print(f"\n  {_PU}{_BD}TypeShu MCP Monitor{_R} - aguardando primeiro ping...")
    print(f"  {_DIM}SQLite : {TELEM_DB}")
    print(f"  audit  : {AUDIT_FILE}{_R}")
    print()
    time.sleep(_PING_INTERVAL + 0.5)
    os.system("cls" if sys.platform == "win32" else "clear")

    try:
        _render_loop(s)
    except KeyboardInterrupt:
        print(f"\n  {_DIM}Monitor encerrado.{_R}\n")


if __name__ == "__main__":
    main()
