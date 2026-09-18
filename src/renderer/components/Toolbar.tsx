// [mcp-local harness] feature: toolbar-remove-prefs | plano: 9ce691b3 | 2026-09-18
// Remove onPrefs (gear migrou para ActivityBar)
import React from 'react'

export interface ToolbarProps {
  onBulletList:     () => void
  onOrderedList:    () => void
  onInsertTable:    () => void
  onInsertFootnote: () => void
}

export function Toolbar({
  onBulletList, onOrderedList, onInsertTable, onInsertFootnote,
}: ToolbarProps): React.JSX.Element {
  return (
    <div className="toolbar">
      <button className="tb-btn tb-btn--icon" onClick={onBulletList} title="Bullet List (Ctrl+Shift+[)" aria-label="Bullet List">
        <TbIconBulletList />
      </button>
      <button className="tb-btn tb-btn--icon" onClick={onOrderedList} title="Ordered List (Ctrl+Shift+])" aria-label="Ordered List">
        <TbIconOrderedList />
      </button>
      <button className="tb-btn tb-btn--icon" onClick={onInsertTable} title="Insert Table (Ctrl+T)" aria-label="Insert Table">
        <TbIconTable />
      </button>
      <button
        className="tb-btn"
        onClick={onInsertFootnote}
        title="Insert Footnote"
        aria-label="Insert Footnote"
        style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '-0.02em', padding: '0 6px', minWidth: 32 }}
      >
        [^1]
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
