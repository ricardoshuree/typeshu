// [mcp-local harness] feature: replace-in-document | plano: 25f77ea9 | 2026-09-17 22:10:21
// FindBar com modo replace: segunda linha com campo de substituição, botões Substituir e Todos
/**
 * FindBar.tsx
 *
 * Barra de busca/substituição inline no topo do editor.
 *
 * Ctrl+F → abre em modo find (showReplace=false)
 * Ctrl+H → abre em modo replace (showReplace=true)
 * Botão ▸/▾ na barra alterna entre os modos
 *
 * Atalhos:
 *   Enter / ▼       → próximo match
 *   Shift+Enter / ▲ → match anterior
 *   Escape          → fecha
 *   (no campo replace) Enter → substituir atual
 */
import React, { useRef, useEffect, useState } from 'react'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

interface FindBarProps {
  showReplace:    boolean
  onFind:         (query: string, caseSensitive: boolean) => void
  onNext:         () => void
  onPrev:         () => void
  onReplaceOne:   (replacement: string) => void
  onReplaceAll:   (replacement: string) => void
  onClose:        () => void
  matchCount:     number
  currentMatch:   number
  locale:         Locale
}

export function FindBar({
  showReplace, onFind, onNext, onPrev,
  onReplaceOne, onReplaceAll, onClose,
  matchCount, currentMatch, locale,
}: FindBarProps): React.JSX.Element {
  const [query,         setQuery]         = useState('')
  const [replacement,   setReplacement]   = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [replaceMode,   setReplaceMode]   = useState(showReplace)

  const findRef    = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  // Foca o input de busca ao montar
  useEffect(() => { findRef.current?.focus(); findRef.current?.select() }, [])

  // Sincroniza replaceMode com prop externa (quando pai alterna Ctrl+F vs Ctrl+H)
  useEffect(() => { setReplaceMode(showReplace) }, [showReplace])

  // Dispara busca ao mudar query ou caseSensitive
  useEffect(() => { onFind(query, caseSensitive) }, [query, caseSensitive])

  function handleFindKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) onPrev(); else onNext()
    }
    if (e.key === 'Tab' && replaceMode) {
      e.preventDefault(); replaceRef.current?.focus()
    }
  }

  function handleReplaceKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) onReplaceAll(replacement)
      else            onReplaceOne(replacement)
    }
    if (e.key === 'Tab') {
      e.preventDefault(); findRef.current?.focus()
    }
  }

  const hasResults = matchCount > 0
  const label      = !query      ? ''
                   : !hasResults ? t('find.noResults', locale)
                   : `${currentMatch + 1} ${t('find.ofCount', locale)} ${matchCount}`
  const noMatch    = !!query && !hasResults

  return (
    <div className={`find-bar ${replaceMode ? 'find-bar--replace' : ''}`}>

      {/* Linha de busca */}
      <div className="find-bar-row">
        {/* Toggle expand/collapse replace */}
        <button
          className="find-bar-toggle"
          title={replaceMode ? t('find.hideReplace', locale) : t('find.showReplace', locale)}
          onClick={() => setReplaceMode(v => !v)}
        >{replaceMode ? '▾' : '▸'}</button>

        <div className={`find-bar-input-wrap ${noMatch ? 'find-bar-input-wrap--no-match' : ''}`}>
          <span className="find-bar-icon">🔍</span>
          <input
            ref={findRef}
            className="find-bar-input"
            type="text"
            placeholder={t('find.placeholder', locale)}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleFindKeyDown}
            spellCheck={false}
          />
          {label && (
            <span className={`find-bar-count ${noMatch ? 'find-bar-count--no-match' : ''}`}>
              {label}
            </span>
          )}
        </div>

        <button
          className={`find-bar-btn find-bar-btn--case ${caseSensitive ? 'find-bar-btn--active' : ''}`}
          title={t('find.caseSensitive', locale)}
          onClick={() => setCaseSensitive(v => !v)}
        >Aa</button>

        <button className="find-bar-btn" title={t('find.prev', locale)} onClick={onPrev} disabled={!hasResults}>▲</button>
        <button className="find-bar-btn" title={t('find.next', locale)} onClick={onNext} disabled={!hasResults}>▼</button>
        <button className="find-bar-btn find-bar-btn--close" title={t('find.close', locale)} onClick={onClose}>✕</button>
      </div>

      {/* Linha de substituição — só aparece no modo replace */}
      {replaceMode && (
        <div className="find-bar-row find-bar-row--replace">
          {/* Espaçador alinha com o campo de busca */}
          <span className="find-bar-toggle-spacer" />

          <div className="find-bar-input-wrap">
            <span className="find-bar-icon">⇄</span>
            <input
              ref={replaceRef}
              className="find-bar-input"
              type="text"
              placeholder={t('find.replacePlaceholder', locale)}
              value={replacement}
              onChange={e => setReplacement(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              spellCheck={false}
            />
          </div>

          <button
            className="find-bar-btn find-bar-btn--replace"
            title={t('find.replaceOne', locale)}
            onClick={() => onReplaceOne(replacement)}
            disabled={!hasResults}
          >{t('find.replaceBtn', locale)}</button>

          <button
            className="find-bar-btn find-bar-btn--replace"
            title={t('find.replaceAll', locale)}
            onClick={() => onReplaceAll(replacement)}
            disabled={!hasResults}
          >{t('find.replaceAllBtn', locale)}</button>
        </div>
      )}
    </div>
  )
}
