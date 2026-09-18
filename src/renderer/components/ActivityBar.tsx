// [mcp-local harness] feature: activity-bar-settings | plano: cf094fd7 | 2026-09-18
// +onPrefs prop + gear SVG fixado no bottom da activity bar
import React from 'react'

export interface ActivityBarProps {
  sidebarOpen:     boolean
  onToggleSidebar: () => void
  onQuickOpen:     () => void
  onPrefs:         () => void
}

export function ActivityBar({ sidebarOpen, onToggleSidebar, onQuickOpen, onPrefs }: ActivityBarProps): React.JSX.Element {
  return (
    <div className="activity-bar">
      {/* Ícones do topo */}
      <div className="activity-bar-top">
        <button
          className={`activity-btn${sidebarOpen ? ' activity-btn--active' : ''}`}
          onClick={onToggleSidebar}
          title="Explorer (Ctrl+Shift+L)"
          aria-label="Toggle Explorer"
        >
          <IconExplorer />
          {sidebarOpen && <span className="activity-btn-indicator" />}
        </button>

        <button
          className="activity-btn"
          onClick={onQuickOpen}
          title="Busca rápida (Ctrl+P)"
          aria-label="Busca rápida"
        >
          <IconSearch />
        </button>
      </div>

      {/* Gear fixado no bottom — como VS Code */}
      <div className="activity-bar-bottom">
        <button
          className="activity-btn"
          onClick={onPrefs}
          title="Preferências (Ctrl+,)"
          aria-label="Preferências"
        >
          <IconGear />
        </button>
      </div>
    </div>
  )
}

function IconExplorer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <polyline points="13 2 13 9 20 9"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="16.5" y1="16.5" x2="21" y2="21"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconGear() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
