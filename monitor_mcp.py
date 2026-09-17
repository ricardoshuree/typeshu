# [mcp-local harness] feature: monitor-restore-bars | plano: 112af46f | 2026-09-17 11:50:15
# Restaurar barras de duracao com blocos Unicode solidos e cores originais
# [mcp-local harness] feature: monitor-restore-bars | plano: 112af46f | 2026-09-17 11:48:52
# Restaurar barras de duracao com blocos Unicode e cores originais
"""
monitor_mcp.py - TypeMarkLee MCP Monitor
Uso:
  python monitor_mcp.py             -> roda no terminal atual
  python monitor_mcp.py --terminal  -> abre em nova janela PowerShell
  Encerrar: Ctrl+C

Fica na RAIZ do projeto (C:\\project-claude\\typeshurelee\\).

Fontes de dados:
  - mcp-local/monitor/tool_calls.db  -> duracao (ms) e status ok/erro por chamada
  - mcp-local/mcp_audit.jsonl        -> feature e path por operacao

Layout por linha:
  HH:MM:SS  ok  write_file  12.8 ms  blocos  feature  [EXT] path/arquivo.ts
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
        f'$host.UI.RawUI.WindowTitle = "TypeMarkLee Monitor"\r\n'
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
    ], creationflags=0x00000010)  # CREATE_NEW_CONSOLE
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

_R   = "\033[0m"
_G   = "\x1b[38;5;82m"
_GN  = "\x1b[38;5;190m"
_RD  = "\x1b[38;5;160m"
_AM  = "\x1b[38;5;208m"
_DIM = "\x1b[2m"
_BD  = "\x1b[1m"
_GR  = "\x1b[38;5;240m"
_CY  = "\x1b[38;5;39m"
_BL  = "\x1b[38;5;75m"
_PU  = "\x1b[38;5;141m"

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
    "write_file":     _GN,
    "read_file":      _DIM,
    "list_dir":       _GR,
    "reject_change":  _AM,
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
        c = _G if self.lat_ms < 50 else (_GN if self.lat_ms < 200 else _AM)
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
    """Sparkline do historico de latencia com blocos Unicode coloridos."""
    vals = [v for v in history if v is not None]
    if not vals:
        return _GR + ("\u2500" * width) + _R
    vmax = max(vals) or 1
    out = []
    for v in list(history)[-width:]:
        if v is None:
            out.append(f"{_RD}\u2500{_R}")
        else:
            idx = max(1, int((v / vmax) * (len(_BLOCKS) - 1)))
            c   = _G if v < 50 else (_GN if v < 200 else _AM)
            out.append(f"{c}{_BLOCKS[idx]}{_R}")
    return "".join(out)


def _dur_bar(dur_ms: float, max_ms: float, width: int = _BAR_W) -> str:
    """Barra de duracao: blocos solidos coloridos + fundo cinza."""
    if max_ms <= 0:
        max_ms = 1
    ratio  = min(dur_ms / max_ms, 1.0)
    filled = max(1, int(ratio * width))
    empty  = width - filled
    c = _G if dur_ms < 50 else (_GN if dur_ms < 200 else _AM)
    return f"{c}{'\u2588' * filled}{_R}{_GR}{'\u2591' * empty}{_R}"


def _read_telem(n: int = _ROWS * 2) -> list[dict]:
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


def _read_audit(n: int = _ROWS * 3) -> list[dict]:
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


def _audit_ts_float(e: dict) -> float:
    raw = str(e.get("ts") or e.get("timestamp") or e.get("created_at") or "0")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except Exception:
        try:
            return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").timestamp()
        except Exception:
            return 0.0


def _unified_rows(n: int = _ROWS) -> list[dict]:
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


def _short_path(path: str, max_w: int = _PATH_W) -> str:
    p = path.replace("\\", "/")
    if len(p) > max_w:
        p = "..." + p[-(max_w - 3):]
    return p


def _file_icon(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return _EXT_ICON.get(ext, "  ")


def _render_calls(rows: list[dict]) -> list[str]:
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
        c_dur = _G if dur < 50 else (_GN if dur < 200 else _AM)
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
        f"\u2588{_R}{_DIM}=rapido(verde)  \u2588{_R}{_DIM}=normal(amarelo)  "
        f"\u2588{_R}{_DIM}=lento(laranja)  "
        f"\u2591{_R}{_GR}=vazio  audit:{_R} {jl_st}"
    )


def _mcp_block(s: MCPStatus) -> list[str]:
    dot = f"{_G}[ON]{_R}" if s.alive else f"{_RD}[OFF]{_R}"
    lc  = _G if s.alive else _RD
    h   = _hist(s.history, _HIST_W)
    dup = f"  {_AM}!! {s.instancias} instancias{_R}" if s.instancias > 1 else ""

    l1 = f"  {dot} {_PU}{_BD}MCP-TYPESHURELEE{_R}  {h}{dup}"
    l2 = (
        f"       {_DIM}{'-'*16}{_R}  "
        f"{lc}{s.lat_str():>8}{_R}  "
        f"{_DIM}up {s.uptime_str():<10}{_R}  "
        f"{_GR}{s.pid_str()}{_R}"
    )
    return [l1, l2]


def _legend_ping() -> list[str]:
    return [
        f"  {_DIM}ping: cada bloco = {_PING_INTERVAL:.0f}s  "
        f"{_G}\u2587{_R}{_DIM}=rapido  "
        f"{_GN}\u2587{_R}{_DIM}=normal  "
        f"{_AM}\u2587{_R}{_DIM}=alto  "
        f"{_RD}\u2500{_R}{_DIM}=offline{_R}",
        f"  {_AM}!! N instancias{_R}{_DIM} = multiplos processos server.py rodando "
        f"(reinicie o MCP){_R}",
    ]


def _sep(c="-"):
    return f"  {_GR}{c * (_LINE_W - 4)}{_R}"


def _header():
    now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    return f"  {_PU}{_BD}TypeMarkLee - MCP Monitor{_R}  {_DIM}{now}{_R}"


def _build(s: MCPStatus) -> list[str]:
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


def _render_loop(s: MCPStatus):
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

    sys.stdout.write("\033]0;monitor_mcp - TypeMarkLee\007")
    sys.stdout.flush()
    os.system("cls" if sys.platform == "win32" else "clear")

    s = MCPStatus()
    threading.Thread(target=_poll, args=(s,), daemon=True).start()

    print(f"\n  {_PU}{_BD}TypeMarkLee MCP Monitor{_R} - aguardando primeiro ping...")
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
