import React from 'react'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

export interface ToolbarProps {
  onBulletList:     () => void
  onOrderedList:    () => void
  onInsertTable:    () => void
  onInsertFootnote: () => void
  sourceMode:       boolean
  onToggleSource:   () => void
  locale:           Locale
}

export function Toolbar({
  onBulletList, onOrderedList, onInsertTable, onInsertFootnote,
  sourceMode, onToggleSource, locale,
}: ToolbarProps): React.JSX.Element {
  return (
    <div className="toolbar">
      <button className="tb-btn tb-btn--icon" onClick={onBulletList} title={t('toolbar.bulletList', locale)} aria-label={t('toolbar.bulletList', locale)}>
        <TbIconBulletList />
      </button>
      <button className="tb-btn tb-btn--icon" onClick={onOrderedList} title={t('toolbar.orderedList', locale)} aria-label={t('toolbar.orderedList', locale)}>
        <TbIconOrderedList />
      </button>
      <button className="tb-btn tb-btn--icon" onClick={onInsertTable} title={t('toolbar.table', locale)} aria-label={t('toolbar.table', locale)}>
        <TbIconTable />
      </button>
      <button
        className="tb-btn"
        onClick={onInsertFootnote}
        title={t('toolbar.footnote', locale)}
        aria-label={t('toolbar.footnote', locale)}
        style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '-0.02em', padding: '0 6px', minWidth: 32 }}
      >
        [^1]
      </button>

      <span className="tb-spacer" />

      <button
        className={`tb-btn${sourceMode ? ' tb-btn--active' : ''}`}
        onClick={onToggleSource}
        title={t('toolbar.source', locale)}
        aria-label={t('toolbar.source', locale)}
        style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '-0.02em', padding: '0 8px', minWidth: 'auto', whiteSpace: 'nowrap' }}
      >
        {sourceMode ? t('toolbar.markRender', locale) : t('toolbar.markSource', locale)}
      </button>
    </div>
  )
}

function TbIconBulletList() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="3" cy="4.5"  r="1.25" fill="currentColor"/>
      <circle cx="3" cy="8"    r="1.25" fill="currentColor"/>
      <circle cx="3" cy="11.5" r="1.25" fill="currentColor"/>
      <line x1="6" y1="4.5"  x2="14" y2="4.5"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="8"    x2="14" y2="8"    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function TbIconOrderedList() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <text x="1.5" y="5.5"  fontSize="5" fontWeight="700" fill="currentColor" fontFamily="monospace">1.</text>
      <text x="1.5" y="9"    fontSize="5" fontWeight="700" fill="currentColor" fontFamily="monospace">2.</text>
      <text x="1.5" y="12.5" fontSize="5" fontWeight="700" fill="currentColor" fontFamily="monospace">3.</text>
      <line x1="6" y1="4.5"  x2="14" y2="4.5"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="8"    x2="14" y2="8"    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function TbIconTable() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <line x1="1.5" y1="6"   x2="14.5" y2="6"   stroke="currentColor" strokeWidth="1.25"/>
      <line x1="1.5" y1="9.5" x2="14.5" y2="9.5" stroke="currentColor" strokeWidth="1.25"/>
      <line x1="6"   y1="6"   x2="6"    y2="13.5" stroke="currentColor" strokeWidth="1.25"/>
      <line x1="10"  y1="6"   x2="10"   y2="13.5" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="1.5" y="2.5" width="13" height="3.5" rx="1.5" fill="currentColor" opacity="0.12"/>
    </svg>
  )
}
