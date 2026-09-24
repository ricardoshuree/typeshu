// [mcp-local harness] feature: toolbars-v2-fix3 | plano: 7e079ba3 | 2026-09-18
// Fix definitivo: salva from/to ProseMirror no mousedown e restaura via executeWithSelection
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

export interface FloatingToolbarProps {
  editorContainerRef:   React.RefObject<HTMLElement>
  /** Restaura seleção salva (from/to) e executa fn() */
  onExecute:            (from: number, to: number, fn: () => void) => void
  onBold:               () => void
  onItalic:             () => void
  onStrike:             () => void
  onInlineCode:         () => void
  onLink:               () => void
  onBlockquote:         () => void
  onHeading:            (level: 0|1|2|3|4|5|6) => void
  locale:               Locale
}

function buildHeadingItems(locale: Locale): { level: 0|1|2|3|4|5|6; label: string }[] {
  return [
    { level: 0, label: t('ftb.paragraph', locale) },
    { level: 1, label: t('ftb.h1', locale) },
    { level: 2, label: t('ftb.h2', locale) },
    { level: 3, label: t('ftb.h3', locale) },
    { level: 4, label: t('ftb.h4', locale) },
    { level: 5, label: t('ftb.h5', locale) },
    { level: 6, label: t('ftb.h6', locale) },
  ]
}

interface Pos { top: number; left: number }

// Lê from/to diretamente do ProseMirror via DOM
function getProseMirrorSelection(container: HTMLElement | null): { from: number; to: number } | null {
  if (!container) return null
  // O ProseMirror expõe a view no DOM via __prosemirror_view__
  const pm = (container as any)._prosemirror_view_
    || (container.querySelector('.ProseMirror') as any)?.__prosemirror_view__
  if (pm?.state?.selection) {
    return { from: pm.state.selection.from, to: pm.state.selection.to }
  }
  // Fallback: tenta via atributo interno do ProseMirror
  const editorEl = container.querySelector('.ProseMirror')
  if (editorEl) {
    const view = (editorEl as any).pmViewDesc?.view
    if (view?.state?.selection) {
      return { from: view.state.selection.from, to: view.state.selection.to }
    }
  }
  return null
}

export function FloatingToolbar({
  editorContainerRef,
  onExecute, onBold, onItalic, onStrike, onInlineCode, onLink, onBlockquote, onHeading,
  locale,
}: FloatingToolbarProps): React.JSX.Element | null {
  const [visible, setVisible]         = useState(false)
  const [pos, setPos]                 = useState<Pos>({ top: 0, left: 0 })
  const [headingOpen, setHeadingOpen] = useState(false)
  const tbRef                         = useRef<HTMLDivElement>(null)
  const headingRef                    = useRef<HTMLDivElement>(null)
  const mouseDownRef                  = useRef(false)
  // Seleção ProseMirror salva no momento do mousedown na toolbar
  const savedSelRef                   = useRef<{ from: number; to: number } | null>(null)

  const updatePosition = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setVisible(false); setHeadingOpen(false); return
    }
    const container = editorContainerRef.current
    if (container) {
      const node = sel.anchorNode
      if (!node || !container.contains(node)) {
        setVisible(false); setHeadingOpen(false); return
      }
    }
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) { setVisible(false); return }

    const tbWidth = 280
    const offset  = 8
    let left = rect.left + rect.width / 2 - tbWidth / 2
    left = Math.max(8, Math.min(left, window.innerWidth - tbWidth - 8))
    setPos({ top: rect.top - offset, left })
    setVisible(true)
  }, [editorContainerRef])

  useEffect(() => {
    const onSelChange = () => { if (!mouseDownRef.current) updatePosition() }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  }, [updatePosition])

  useEffect(() => {
    const onDown = () => { mouseDownRef.current = true }
    const onUp   = () => { mouseDownRef.current = false; updatePosition() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('mouseup',   onUp)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('mouseup', onUp) }
  }, [updatePosition])

  useEffect(() => {
    if (!headingOpen) return
    const onDown = (e: MouseEvent) => {
      if (headingRef.current?.contains(e.target as Node)) return
      setHeadingOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [headingOpen])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setVisible(false); setHeadingOpen(false) }
    }
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [visible])

  // Salva a seleção ProseMirror ANTES de qualquer clique na toolbar
  const saveSelection = useCallback(() => {
    const sel = getProseMirrorSelection(editorContainerRef.current)
    savedSelRef.current = sel
    return sel
  }, [editorContainerRef])

  // Wrapper: salva seleção no mousedown, executa via onExecute
  const btn = useCallback((fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    const saved = savedSelRef.current
    if (saved) {
      onExecute(saved.from, saved.to, fn)
    } else {
      fn()
    }
    setTimeout(updatePosition, 80)
  }, [onExecute, updatePosition])

  const pickHeading = useCallback((level: 0|1|2|3|4|5|6) => (e: React.MouseEvent) => {
    e.preventDefault()
    setHeadingOpen(false)
    const saved = savedSelRef.current
    if (saved) {
      onExecute(saved.from, saved.to, () => onHeading(level))
    } else {
      onHeading(level)
    }
    setTimeout(updatePosition, 80)
  }, [onExecute, onHeading, updatePosition])

  if (!visible) return null

  const headingItems = buildHeadingItems(locale)

  return (
    <div
      ref={tbRef}
      className="ftb"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => {
        e.preventDefault()
        saveSelection()  // salva seleção ProseMirror antes de qualquer outro handler
      }}
    >
      {/* Heading dropdown */}
      <div ref={headingRef} className="ftb-heading-wrap">
        <button
          className={`ftb-btn ftb-btn--heading ${headingOpen ? 'ftb-btn--active' : ''}`}
          onMouseDown={e => { e.preventDefault(); saveSelection(); setHeadingOpen(v => !v) }}
          title={t('ftb.heading', locale)}
          aria-haspopup="listbox"
          aria-expanded={headingOpen}
        >
          H <FtbChevron />
        </button>
        {headingOpen && (
          <div className="ftb-heading-menu" role="listbox">
            {headingItems.map(({ level, label }) => (
              <button
                key={level}
                className={`ftb-heading-item ftb-heading-item--${level === 0 ? 'p' : `h${level}`}`}
                onMouseDown={pickHeading(level)}
                role="option"
              >
                <span className="ftb-heading-tag">{level === 0 ? 'P' : `H${level}`}</span>
                <span className="ftb-heading-label">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="ftb-sep" />

      <button className="ftb-btn ftb-btn--bold"  onMouseDown={btn(onBold)}       title={t('ftb.bold', locale)}>B</button>
      <button className="ftb-btn ftb-btn--italic" onMouseDown={btn(onItalic)}     title={t('ftb.italic', locale)}>I</button>
      <button className="ftb-btn ftb-btn--strike" onMouseDown={btn(onStrike)}     title={t('ftb.strike', locale)}>S</button>

      <span className="ftb-sep" />

      <button className="ftb-btn" onMouseDown={btn(onInlineCode)} title={t('ftb.code', locale)}><FtbIconCode /></button>
      <button className="ftb-btn" onMouseDown={btn(onLink)}       title={t('ftb.link', locale)}><FtbIconLink /></button>
      <button className="ftb-btn" onMouseDown={btn(onBlockquote)} title={t('ftb.blockquote', locale)}><FtbIconQuote /></button>
    </div>
  )
}

function FtbChevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M1.5 2.5L4 5.5L6.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FtbIconCode() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 5L2 8l3 3M11 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FtbIconLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 9.5a3.536 3.536 0 0 0 5 0l2-2a3.536 3.536 0 0 0-5-5L7 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9.5 6.5a3.536 3.536 0 0 0-5 0l-2 2a3.536 3.536 0 0 0 5 5L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function FtbIconQuote() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 5h2.5a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1H3.5A.5.5 0 0 1 3 9V5z" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M9 5h2.5a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1H9.5A.5.5 0 0 1 9 9V5z"  stroke="currentColor" strokeWidth="1.25"/>
      <path d="M4.5 9.5c0 1.5.5 2.5 1.5 2.5M10.5 9.5c0 1.5.5 2.5 1.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}
