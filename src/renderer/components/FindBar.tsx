// [mcp-local harness] feature: find-in-document | plano: 4556a48f | 2026-09-17 21:56:08
// FindBar: barra flutuante com input, contador, Aa toggle, navegação
/**
 * FindBar.tsx
 *
 * Barra de busca inline flutuante no topo do editor.
 * Aparece quando o usuário pressiona Ctrl+F.
 *
 * Props:
 *   onFind(query, caseSensitive) — chamado ao digitar (debounced no pai)
 *   onNext() / onPrev()         — navegação
 *   onClose()                   — fecha a barra
 *   matchCount                  — total de matches
 *   currentMatch                — índice atual (0-based, -1 = nenhum)
 */
import React, { useRef, useEffect, useState } from 'react'

interface FindBarProps {
  onFind:         (query: string, caseSensitive: boolean) => void
  onNext:         () => void
  onPrev:         () => void
  onClose:        () => void
  matchCount:     number
  currentMatch:   number   // 0-based, -1 = sem resultado
}

export function FindBar({ onFind, onNext, onPrev, onClose, matchCount, currentMatch }: FindBarProps): React.JSX.Element {
  const [query, setQuery]               = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Foca o input ao montar
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  // Dispara busca ao mudar query ou caseSensitive
  useEffect(() => { onFind(query, caseSensitive) }, [query, caseSensitive])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) onPrev()
      else            onNext()
    }
  }

  const hasResults  = matchCount > 0
  const label       = !query      ? ''
                    : !hasResults ? 'Sem resultados'
                    : `${currentMatch + 1} de ${matchCount}`
  const noMatch     = query && !hasResults

  return (
    <div className="find-bar">
      <div className={`find-bar-input-wrap ${noMatch ? 'find-bar-input-wrap--no-match' : ''}`}>
        <span className="find-bar-icon">🔍</span>
        <input
          ref={inputRef}
          className="find-bar-input"
          type="text"
          placeholder="Buscar no documento…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
        {label && <span className={`find-bar-count ${noMatch ? 'find-bar-count--no-match' : ''}`}>{label}</span>}
      </div>

      <button
        className={`find-bar-btn find-bar-btn--case ${caseSensitive ? 'find-bar-btn--active' : ''}`}
        title="Diferenciar maiúsculas (Alt+C)"
        onClick={() => setCaseSensitive(v => !v)}
      >Aa</button>

      <button
        className="find-bar-btn"
        title="Anterior (Shift+Enter)"
        onClick={onPrev}
        disabled={!hasResults}
      >▲</button>

      <button
        className="find-bar-btn"
        title="Próximo (Enter)"
        onClick={onNext}
        disabled={!hasResults}
      >▼</button>

      <button
        className="find-bar-btn find-bar-btn--close"
        title="Fechar (Esc)"
        onClick={onClose}
      >✕</button>
    </div>
  )
}
