// [mcp-local harness] feature: open-quickly | plano: 91e7f8b1 | 2026-09-17 15:07:55
// Componente QuickOpen: modal fuzzy de busca de arquivos com teclado e highlight
/**
 * QuickOpen.tsx
 *
 * Modal de busca fuzzy de arquivos — abre com Ctrl+P, fecha com Esc.
 *
 * Comportamento:
 * - Lista todos os arquivos .md/.txt da pasta aberta (recursivo até 3 níveis)
 * - Filtra em tempo real enquanto o usuário digita (busca fuzzy por nome)
 * - Navegação com ↑/↓, seleção com Enter ou clique
 * - Mostra o path relativo como descrição
 * - Fecha ao clicar fora do modal (backdrop)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { FileEntry, DirListResult } from '@shared/types'

declare const window: Window & {
  api: {
    listDir: (dirPath: string) => Promise<DirListResult>
    openPath: (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
  }
}

interface QuickOpenProps {
  dirPath:    string | null    // pasta raiz para buscar arquivos
  onOpen:     (path: string, content: string) => void
  onClose:    () => void
}

interface FileItem {
  name:         string
  path:         string
  relativePath: string   // para exibição
}

// ── Busca recursiva de arquivos ──────────────────────────────────────────
async function collectFiles(
  dirPath: string,
  rootPath: string,
  depth = 0,
  maxDepth = 4
): Promise<FileItem[]> {
  if (depth > maxDepth) return []
  const result = await window.api.listDir(dirPath)
  if (!result.success || !result.entries) return []

  const items: FileItem[] = []
  const SUPPORTED = /\.(md|markdown|txt)$/i
  const SKIP = /^(node_modules|\.git|dist|release|\.cache)$/

  for (const entry of result.entries) {
    if (SKIP.test(entry.name)) continue
    if (entry.isDirectory) {
      const sub = await collectFiles(entry.path, rootPath, depth + 1, maxDepth)
      items.push(...sub)
    } else if (SUPPORTED.test(entry.name)) {
      const relativePath = entry.path
        .replace(rootPath, '')
        .replace(/^[\\/]/, '')
        .replace(/\\/g, '/')
      items.push({ name: entry.name, path: entry.path, relativePath })
    }
  }
  return items
}

// ── Fuzzy match: retorna score (maior = melhor) ou -1 se não bate ────────
function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  // Match exato no nome
  if (t.includes(q)) return 100 - t.indexOf(q)

  // Fuzzy: todos os chars do query aparecem em ordem no target
  let qi = 0
  let score = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { qi++; score++ }
  }
  return qi === q.length ? score : -1
}

// ── Componente ───────────────────────────────────────────────────────────
export function QuickOpen({ dirPath, onOpen, onClose }: QuickOpenProps): React.JSX.Element {
  const [query,    setQuery]    = useState('')
  const [files,    setFiles]    = useState<FileItem[]>([])
  const [filtered, setFiltered] = useState<FileItem[]>([])
  const [selected, setSelected] = useState(0)
  const [loading,  setLoading]  = useState(true)

  const inputRef   = useRef<HTMLInputElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)

  // ── Carrega arquivos da pasta ──────────────────────────────────────────
  useEffect(() => {
    if (!dirPath) { setLoading(false); return }
    setLoading(true)
    collectFiles(dirPath, dirPath).then((items) => {
      // Ordena alfabeticamente por nome
      items.sort((a, b) => a.name.localeCompare(b.name))
      setFiles(items)
      setFiltered(items)
      setLoading(false)
    })
  }, [dirPath])

  // ── Filtra enquanto digita ─────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) {
      setFiltered(files)
      setSelected(0)
      return
    }
    const scored = files
      .map(f => ({ file: f, score: fuzzyScore(query, f.name) + fuzzyScore(query, f.relativePath) * 0.5 }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.file)
    setFiltered(scored)
    setSelected(0)
  }, [query, files])

  // ── Foco no input ao abrir ─────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // ── Scroll do item selecionado ─────────────────────────────────────────
  useEffect(() => {
    const item = listRef.current?.children[selected] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  // ── Abre o arquivo selecionado ─────────────────────────────────────────
  const openSelected = useCallback(async (idx: number) => {
    const file = filtered[idx]
    if (!file) return
    const result = await window.api.openPath(file.path)
    if (result.success && result.content !== undefined && result.path) {
      onOpen(result.path, result.content)
    }
    onClose()
  }, [filtered, onOpen, onClose])

  // ── Teclado ────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(v => Math.min(v + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(v => Math.max(v - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      openSelected(selected)
      return
    }
  }, [filtered, selected, onClose, openSelected])

  // ── Highlight do match ─────────────────────────────────────────────────
  function highlight(text: string, q: string): React.ReactNode {
    if (!q.trim()) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx < 0) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="qo-match">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  return (
    <div className="qo-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="qo-modal" onKeyDown={handleKeyDown}>
        {/* Input de busca */}
        <div className="qo-input-wrap">
          <span className="qo-icon">⌕</span>
          <input
            ref={inputRef}
            className="qo-input"
            placeholder="Buscar arquivo..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
          />
          <span className="qo-hint">Esc para fechar</span>
        </div>

        {/* Lista de resultados */}
        <div className="qo-list" ref={listRef}>
          {loading && (
            <div className="qo-empty">Carregando arquivos...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="qo-empty">
              {files.length === 0
                ? 'Nenhuma pasta aberta. Abra uma pasta na sidebar primeiro.'
                : `Nenhum resultado para "${query}"`}
            </div>
          )}
          {!loading && filtered.map((file, i) => (
            <div
              key={file.path}
              className={`qo-item${i === selected ? ' qo-item--selected' : ''}`}
              onMouseDown={() => openSelected(i)}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="qo-item-name">{highlight(file.name, query)}</span>
              <span className="qo-item-path">{file.relativePath}</span>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        {!loading && filtered.length > 0 && (
          <div className="qo-footer">
            {filtered.length} arquivo{filtered.length !== 1 ? 's' : ''}
            <span className="qo-footer-keys">↑↓ navegar · Enter abrir</span>
          </div>
        )}
      </div>
    </div>
  )
}
