// [mcp-local harness] feature: polish-ui | plano: 5583e164 | 2026-09-18
// Gear SVG redesenhado estilo VS Code (dentes arredondados, proporções corretas)
import React from 'react'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

export interface ActivityBarProps {
  sidebarOpen:     boolean
  onToggleSidebar: () => void
  onQuickOpen:     () => void
  onPrefs:         () => void
  locale:          Locale
}

export function ActivityBar({ sidebarOpen, onToggleSidebar, onQuickOpen, onPrefs, locale }: ActivityBarProps): React.JSX.Element {
  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <button
          className={`activity-btn${sidebarOpen ? ' activity-btn--active' : ''}`}
          onClick={onToggleSidebar}
          title={t('ab.explorer', locale)}
          aria-label={t('ab.explorerLabel', locale)}
        >
          <IconExplorer />
          {sidebarOpen && <span className="activity-btn-indicator" />}
        </button>

        <button
          className="activity-btn"
          onClick={onQuickOpen}
          title={t('ab.search', locale)}
          aria-label={t('ab.searchLabel', locale)}
        >
          <IconSearch />
        </button>
      </div>

      <div className="activity-bar-bottom">
        <button
          className="activity-btn"
          onClick={onPrefs}
          title={t('ab.prefs', locale)}
          aria-label={t('ab.prefsLabel', locale)}
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

// Gear estilo VS Code: 8 dentes com pontas arredondadas, círculo central grande
function IconGear() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}
