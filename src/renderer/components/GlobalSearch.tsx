// [mcp-local harness] feature: global-search | plano: f149f65d | 2026-09-17 15:33:35
// Componente GlobalSearch: painel lateral com busca debounced, resultados agrupados por arquivo, highlight e navegação por clique
/**
 * GlobalSearch.tsx
 *
 * Painel de busca de texto em todos os arquivos da pasta.
 * Abre via Ctrl+Shift+F, fecha com Esc ou clicando no X.
 *
 * Comportamento:
 * - Input de busca com debounce de 300ms
 * - Resultados agrupados por arquivo
 * - Cada resultado mostra o número da linha e o trecho com highlight
 * - Clique em um resultado abre o arquivo e tenta rolar até a linha
 * - Toggle case-sensitive
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchResult, SearchFileResult, SearchMatch } from '@shared/types'

declare const window: Window & {
  api: {
    searchFiles: (dirPath: string, query: string, caseSensitive: boolean) => Promise<SearchResult>
    openPath:    (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
  }
}

interface GlobalSearchProps {
  dirPath:  string | null
  onOpen:   (path: string, content: string) => void
  onClose:  () => void
}

// ── Highlight de match na linha ──────────────────────────────────────────
function HighlightMatch({ text, start, end }: { text: string; start: number; end: number }): React.JSX.Element {
  // Garante bounds válidos
  const s = Math.max(0, Math.min(start, text.length))
  const e = Math.max(s, Math.min(end, text.length))
  return (
    <span className="gs-line-text">
      {text.slice(0, s)}
      <mark className="gs-match">{text.slice(s, e)}</mark>
      {text.slice(e)}
    </span>
  )
}

// ── Grupo de resultados de um arquivo ────────────────────────────────────
interface FileResultGroupProps {
  result:       SearchFileResult
  onMatchClick: (filePath: string, lineNumber: number) => void
  defaultOpen:  boolean
}

function FileResultGroup({ result, onMatchClick, defaultOpen }: FileResultGroupProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="gs-file-group">
      <div className="gs-file-header" onClick={() => setOpen(v => !v)}>
        <span className="gs-file-arrow">{open ? '▾' : '▸'}</span>
        <span className="gs-file-name">{result.fileName}</span>
        <span className="gs-file-path">{result.relativePath}</span>
        <span className="gs-file-count">{result.matches.length}</span>
      </div>
      {open && (
        <div className="gs-matches">
          {result.matches.map((match: SearchMatch, i: number) => (
            <div
              key={i}
              className="gs-match-row"
              onClick={() => onMatchClick(result.filePath, match.lineNumber)}
            >
              <span className="gs-line-num">{match.lineNumber}</span>
              <HighlightMatch
                text={match.lineText}
                start={match.matchStart}
                end={match.matchEnd}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────
export function GlobalSearch({ dirPath, onOpen, onClose }: GlobalSearchProps): React.JSX.Element {
  const [query,         setQuery]         = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [result,        setResult]        = useState<SearchResult | null>(null)
  const [searching,     setSearching]     = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Foco ao abrir
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  // Busca com debounce
  const runSearch = useCallback(async (q: string, cs: boolean) => {
    if (!dirPath || !q.trim()) { setResult(null); setSearching(false); return }
    setSearching(true)
    try {
      const r = await window.api.searchFiles(dirPath, q, cs)
      setResult(r)
    } catch {
      setResult({ success: false, query: q, results: [], total: 0, error: 'Erro na busca' })
    } finally {
      setSearching(false)
    }
  }, [dirPath])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query, caseSensitive), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, caseSensitive, runSearch])

  // Esc fecha
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }, [onClose])

  // Abre arquivo e tenta rolar até a linha
  const handleMatchClick = useCallback(async (filePath: string, lineNumber: number) => {
    const r = await window.api.openPath(filePath)
    if (r.success && r.content !== undefined && r.path) {
      onOpen(r.path, r.content)
      // Aguarda o editor montar e tenta rolar até a linha aproximada
      setTimeout(() => {
        const editor = document.querySelector('.ProseMirror')
        if (!editor) return
        const paras = editor.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote')
        const target = paras[Math.max(0, lineNumber - 2)] as HTMLElement | undefined
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 400)
    }
  }, [onOpen])

  const noDir = !dirPath

  return (
    <div className="gs-panel" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="gs-header">
        <span className="gs-title">BUSCA</span>
        <button className="gs-close" onClick={onClose} title="Fechar (Esc)">✕</button>
      </div>

      {/* Input */}
      <div className="gs-input-wrap">
        <input
          ref={inputRef}
          className="gs-input"
          placeholder={noDir ? 'Abra uma pasta primeiro...' : 'Buscar em arquivos...'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={noDir}
          spellCheck={false}
        />
        <button
          className={`gs-case-btn${caseSensitive ? ' gs-case-btn--active' : ''}`}
          onClick={() => setCaseSensitive(v => !v)}
          title="Case sensitive"
        >
          Aa
        </button>
      </div>

      {/* Resultados */}
      <div className="gs-results">
        {noDir && (
          <div className="gs-empty">Abra uma pasta na sidebar para buscar.</div>
        )}
        {!noDir && !query.trim() && (
          <div className="gs-empty">Digite para buscar em todos os arquivos.</div>
        )}
        {!noDir && query.trim() && searching && (
          <div className="gs-empty">Buscando...</div>
        )}
        {!noDir && result && !searching && result.results.length === 0 && (
          <div className="gs-empty">Nenhum resultado para <strong>"{query}"</strong></div>
        )}
        {!noDir && result && !searching && result.results.length > 0 && (
          <>
            <div className="gs-summary">
              {result.total} resultado{result.total !== 1 ? 's' : ''} em {result.results.length} arquivo{result.results.length !== 1 ? 's' : ''}
            </div>
            {result.results.map((fr) => (
              <FileResultGroup
                key={fr.filePath}
                result={fr}
                onMatchClick={handleMatchClick}
                defaultOpen={result.results.length <= 5}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
