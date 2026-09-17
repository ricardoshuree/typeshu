# [mcp-local harness] feature: fix-start-paths | plano: 4c37387f | 2026-09-17 10:59:39
# Corrigir path do Claude Desktop (Microsoft Store) e detecção do npm pelo path do Node
"""
start.py — TypeMarkLee Environment Starter
==========================================
Orquestra a inicialização completa do ambiente de desenvolvimento:

  1. Verifica Python, Node.js, npm e uv
  2. Instala dependências do MCP (uv sync em mcp-local/)
  3. Instala dependências do app (npm install)
  4. Verifica se o servidor MCP está registrado no Claude Desktop
  5. Inicia o servidor MCP em background (via uv run)
  6. Exibe instruções para iniciar o monitor e o app

Uso:
  python start.py          → inicialização completa
  python start.py --check  → apenas verifica o ambiente, sem subir nada
  python start.py --mcp    → só sobe o servidor MCP
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

# ── Constantes ──────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.resolve()
MCP_DIR     = ROOT / "mcp-local"
MCP_SERVER  = MCP_DIR / "server.py"
MCP_NAME    = "mcp-typeshurelee"
MIN_NODE    = (18, 0)
MIN_PYTHON  = (3, 11)

IS_WIN = platform.system() == "Windows"

# Cores ANSI
R   = "\033[0m"
G   = "\x1b[38;5;82m"
RD  = "\x1b[38;5;160m"
AM  = "\x1b[38;5;208m"
CY  = "\x1b[38;5;39m"
BD  = "\x1b[1m"
DIM = "\x1b[2m"

if IS_WIN:
    try:
        import ctypes
        ctypes.windll.kernel32.SetConsoleMode(ctypes.windll.kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass


def ok(msg: str):  print(f"  {G}✓{R}  {msg}")
def err(msg: str): print(f"  {RD}✗{R}  {msg}")
def warn(msg: str):print(f"  {AM}!{R}  {msg}")
def info(msg: str):print(f"  {CY}→{R}  {msg}")
def hdr(msg: str): print(f"\n{BD}{msg}{R}")


# ── Paths do Claude Desktop ──────────────────────────────────────────────────────
def _claude_config_paths() -> list[Path]:
    """
    Retorna os candidatos de path para o claude_desktop_config.json.
    Suporta instalação via Microsoft Store (LocalCache) e instalação direta.
    """
    paths = []
    if IS_WIN:
        local = os.environ.get("LOCALAPPDATA", "")
        appdata = os.environ.get("APPDATA", "")
        username = os.environ.get("USERNAME", "")

        # Microsoft Store — path real confirmado na máquina do usuário
        # C:\Users\<user>\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\
        store_local = Path(local) / "Packages"
        if store_local.exists():
            for pkg in store_local.glob("Claude_*"):
                candidate = pkg / "LocalCache" / "Roaming" / "Claude" / "claude_desktop_config.json"
                paths.append(candidate)

        # Instalação direta (msi/exe)
        paths.append(Path(appdata) / "Claude" / "claude_desktop_config.json")

        # Fallback com path literal conhecido
        if username:
            paths.append(
                Path(f"C:/Users/{username}/AppData/Local/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude/claude_desktop_config.json")
            )
    else:
        paths.append(Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json")
        paths.append(Path.home() / ".config" / "claude" / "claude_desktop_config.json")

    return paths


# ── Verificações ────────────────────────────────────────────────────────────────

def check_python() -> bool:
    v = sys.version_info
    if (v.major, v.minor) >= MIN_PYTHON:
        ok(f"Python {v.major}.{v.minor}.{v.micro}")
        return True
    err(f"Python {v.major}.{v.minor} — mínimo exigido: {MIN_PYTHON[0]}.{MIN_PYTHON[1]}")
    return False


def check_node() -> bool:
    node = shutil.which("node")
    if not node:
        err("Node.js não encontrado — instale em https://nodejs.org (>=18)")
        return False
    try:
        out = subprocess.check_output(["node", "--version"], text=True).strip()
        parts = out.lstrip("v").split(".")
        major, minor = int(parts[0]), int(parts[1])
        if (major, minor) >= MIN_NODE:
            ok(f"Node.js {out}  ({node})")
            return True
        err(f"Node.js {out} — mínimo exigido: v{MIN_NODE[0]}.{MIN_NODE[1]}")
        return False
    except Exception as e:
        err(f"Erro ao verificar Node.js: {e}")
        return False


def check_npm() -> bool:
    """
    Tenta encontrar o npm de três formas:
      1. shutil.which("npm")  — PATH normal
      2. npm.cmd no Windows   — instaladores que adicionam só o .cmd
      3. Mesmo diretório do node — alguns instaladores colocam npm junto
    """
    # Tentativa 1: PATH direto
    npm = shutil.which("npm") or shutil.which("npm.cmd")

    # Tentativa 2: mesmo diretório do node
    if not npm:
        node = shutil.which("node")
        if node:
            node_dir = Path(node).parent
            for candidate in ["npm", "npm.cmd", "npm.ps1"]:
                p = node_dir / candidate
                if p.exists():
                    npm = str(p)
                    break

    if not npm:
        warn("npm não encontrado no PATH — Node.js instalado mas npm ausente ou não no PATH")
        info("Adicione a pasta do Node ao PATH do sistema e reinicie o terminal")
        return False

    try:
        out = subprocess.check_output([npm, "--version"], text=True, shell=IS_WIN).strip()
        ok(f"npm v{out}  ({npm})")
        return True
    except Exception as e:
        err(f"Erro ao verificar npm ({npm}): {e}")
        return False


def check_uv() -> bool:
    uv = shutil.which("uv")
    if not uv:
        warn("uv não encontrado — instalando via pip...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "uv", "-q"])
            ok("uv instalado")
            return True
        except Exception as e:
            err(f"Falha ao instalar uv: {e}")
            return False
    try:
        out = subprocess.check_output(["uv", "--version"], text=True).strip()
        ok(f"uv {out}")
        return True
    except Exception as e:
        err(f"Erro ao verificar uv: {e}")
        return False


def check_claude_desktop() -> bool:
    """Verifica se o MCP está registrado no claude_desktop_config.json."""
    for cfg_path in _claude_config_paths():
        if cfg_path.exists():
            try:
                cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
                servers = cfg.get("mcpServers", {})
                if MCP_NAME in servers:
                    ok(f"MCP '{MCP_NAME}' registrado")
                    info(f"Config: {cfg_path}")
                    return True
                warn(f"MCP '{MCP_NAME}' NÃO registrado em:")
                info(str(cfg_path))
                _print_mcp_config_hint()
                return False
            except Exception as e:
                warn(f"Erro ao ler {cfg_path}: {e}")

    warn("claude_desktop_config.json não encontrado em nenhum path conhecido")
    info("Paths verificados:")
    for p in _claude_config_paths():
        print(f"     {DIM}{p}{R}")
    _print_mcp_config_hint()
    return False


def _print_mcp_config_hint():
    mcp_dir_path = str(MCP_DIR).replace("/", "\\")
    print()
    info("Trecho a adicionar no claude_desktop_config.json:")
    snippet = {
        "mcp-typeshurelee": {
            "command": "C:\\Users\\Lenovo\\.local\\bin\\uv.EXE",
            "args": ["run", "--directory", mcp_dir_path, "server.py"]
        }
    }
    print(f"\n{DIM}{json.dumps(snippet, indent=2)}{R}\n")


# ── Instalação de dependências ───────────────────────────────────────────────────

def install_mcp_deps() -> bool:
    hdr("Instalando dependências do MCP (uv sync)...")
    try:
        subprocess.check_call(["uv", "sync"], cwd=str(MCP_DIR))
        ok("Dependências do MCP instaladas")
        return True
    except subprocess.CalledProcessError as e:
        err(f"Falha no uv sync: {e}")
        return False


def install_npm_deps() -> bool:
    pkg_json = ROOT / "package.json"
    if not pkg_json.exists():
        warn("package.json não encontrado — npm install pulado (app ainda não scaffolado)")
        return True
    hdr("Instalando dependências do app (npm install)...")
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        node = shutil.which("node")
        if node:
            node_dir = Path(node).parent
            for c in ["npm.cmd", "npm"]:
                p = node_dir / c
                if p.exists():
                    npm = str(p)
                    break
    if not npm:
        err("npm não encontrado — não foi possível instalar dependências do app")
        return False
    try:
        subprocess.check_call([npm, "install"], cwd=str(ROOT), shell=IS_WIN)
        ok("node_modules instalado")
        return True
    except subprocess.CalledProcessError as e:
        err(f"Falha no npm install: {e}")
        return False


# ── Iniciar MCP ──────────────────────────────────────────────────────────────────

def start_mcp() -> subprocess.Popen | None:
    hdr("Iniciando servidor MCP...")
    try:
        uv = shutil.which("uv") or "uv"
        proc = subprocess.Popen(
            [uv, "run", str(MCP_SERVER)],
            cwd=str(MCP_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(1.5)
        if proc.poll() is None:
            ok(f"Servidor MCP iniciado (PID {proc.pid})")
            return proc
        err("Servidor MCP encerrou imediatamente — verifique mcp-local/server.py")
        return None
    except Exception as e:
        err(f"Falha ao iniciar MCP: {e}")
        return None


# ── Main ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TypeMarkLee — inicializador de ambiente")
    parser.add_argument("--check", action="store_true", help="Apenas verifica o ambiente")
    parser.add_argument("--mcp",   action="store_true", help="Só inicia o servidor MCP")
    args = parser.parse_args()

    print(f"\n{BD}{'─' * 55}{R}")
    print(f"{BD}  TypeMarkLee — Inicializador de Ambiente{R}")
    print(f"{BD}{'─' * 55}{R}")

    hdr("Verificando dependências do sistema...")
    py_ok   = check_python()
    node_ok = check_node()
    npm_ok  = check_npm()
    uv_ok   = check_uv()

    hdr("Verificando registro no Claude Desktop...")
    claude_ok = check_claude_desktop()

    if args.check:
        print()
        all_ok = py_ok and node_ok and npm_ok and uv_ok and claude_ok
        if all_ok:
            ok("Ambiente 100% OK — pronto para desenvolver!")
        else:
            warn("Ambiente com itens a corrigir (veja acima)")
        return

    if not (py_ok and uv_ok):
        err("Pré-requisitos mínimos não atendidos — corrija antes de continuar")
        sys.exit(1)

    if args.mcp:
        proc = start_mcp()
        if proc:
            print(f"\n{DIM}Servidor MCP rodando. Ctrl+C para encerrar.{R}")
            try:
                proc.wait()
            except KeyboardInterrupt:
                proc.terminate()
        return

    # Fluxo completo
    install_mcp_deps()
    install_npm_deps()
    proc = start_mcp()

    print(f"\n{BD}{'─' * 55}{R}")
    print(f"{BD}  Ambiente pronto!{R}")
    print(f"{BD}{'─' * 55}{R}")
    if not claude_ok:
        warn("Registre o MCP no Claude Desktop (instruções acima) e reinicie o app")
    info("Para monitorar o MCP:  python monitor_mcp.py")
    if (ROOT / "package.json").exists():
        info("Para rodar o app:      npm run dev")
    else:
        info("Próximo passo: scaffoldar o app (npm init + Electron/Vite)")
    print()

    if proc:
        print(f"{DIM}Servidor MCP rodando (PID {proc.pid}). Ctrl+C para encerrar.{R}\n")
        try:
            proc.wait()
        except KeyboardInterrupt:
            print(f"\n{AM}Encerrando servidor MCP...{R}")
            proc.terminate()


if __name__ == "__main__":
    main()
