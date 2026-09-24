// [mcp-local harness] feature: global-search | plano: f149f65d | 2026-09-17 15:33:35
import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchResult, SearchFileResult, SearchMatch } from '@shared/types'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

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
  locale:   Locale
}

function HighlightMatch({ text, start, end }: { text: string; start: number; end: number }): React.JSX.Element {
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
            <div key={i} className="gs-match-row" onClick={() => onMatchClick(result.filePath, match.lineNumber)}>
              <span className="gs-line-num">{match.lineNumber}</span>
              <HighlightMatch text={match.lineText} start={match.matchStart} end={match.matchEnd} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GlobalSearch({ dirPath, onOpen, onClose, locale }: GlobalSearchProps): React.JSX.Element {
  const [query,         setQuery]         = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [result,        setResult]        = useState<SearchResult | null>(null)
  const [searching,     setSearching]     = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  const runSearch = useCallback(async (q: string, cs: boolean) => {
    if (!dirPath || !q.trim()) { setResult(null); setSearching(false); return }
    setSearching(true)
    try {
      const r = await window.api.searchFiles(dirPath, q, cs)
      setResult(r)
    } catch {
      setResult({ success: false, query: q, results: [], total: 0, error: t('gs.error', locale) })
    } finally {
      setSearching(false)
    }
  }, [dirPath, locale])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query, caseSensitive), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, caseSensitive, runSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }, [onClose])

  const handleMatchClick = useCallback(async (filePath: string, lineNumber: number) => {
    const r = await window.api.openPath(filePath)
    if (r.success && r.content !== undefined && r.path) {
      onOpen(r.path, r.content)
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
  const resultCount = result?.total ?? 0
  const fileCount   = result?.results.length ?? 0
  const resultLabel = resultCount === 1 ? t('gs.result', locale)  : t('gs.resultPlural', locale)
  const fileLabel   = fileCount   === 1 ? t('gs.file', locale)    : t('gs.filePlural', locale)

  return (
    <div className="gs-panel" onKeyDown={handleKeyDown}>
      <div className="gs-header">
        <span className="gs-title">{t('gs.title', locale)}</span>
        <button className="gs-close" onClick={onClose} title={t('gs.close', locale)}>✕</button>
      </div>

      <div className="gs-input-wrap">
        <input
          ref={inputRef}
          className="gs-input"
          placeholder={noDir ? t('gs.placeholderNoDir', locale) : t('gs.placeholder', locale)}
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={noDir}
          spellCheck={false}
        />
        <button
          className={`gs-case-btn${caseSensitive ? ' gs-case-btn--active' : ''}`}
          onClick={() => setCaseSensitive(v => !v)}
          title={t('gs.caseSensitive', locale)}
        >
          Aa
        </button>
      </div>

      <div className="gs-results">
        {noDir && <div className="gs-empty">{t('gs.emptyNoDir', locale)}</div>}
        {!noDir && !query.trim() && <div className="gs-empty">{t('gs.emptyHint', locale)}</div>}
        {!noDir && query.trim() && searching && <div className="gs-empty">{t('gs.searching', locale)}</div>}
        {!noDir && result && !searching && result.results.length === 0 && (
          <div className="gs-empty">{t('gs.noResults', locale)} <strong>"{query}"</strong></div>
        )}
        {!noDir && result && !searching && result.results.length > 0 && (
          <>
            <div className="gs-summary">
              {resultCount} {resultLabel} {t('gs.in', locale)} {fileCount} {fileLabel}
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
