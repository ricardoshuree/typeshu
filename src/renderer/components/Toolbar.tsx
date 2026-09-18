import React from 'react'

export interface ToolbarProps {
  fileName:        string
  isDirty:         boolean
  sidebarOpen:     boolean
  onToggleSidebar: () => void
  onPrefs:         () => void
}

export function Toolbar({
  fileName, isDirty, sidebarOpen, onToggleSidebar, onPrefs,
}: ToolbarProps): React.JSX.Element {
  return (
    <div className="toolbar">
      <button
        className={`tb-btn tb-btn--icon ${sidebarOpen ? 'tb-btn--active' : ''}`}
        onClick={onToggleSidebar}
        title="Toggle Sidebar (Ctrl+Shift+L)"
        aria-label="Toggle Sidebar"
      >
        <TbIconHamburger />
      </button>

      <span className="tb-title" title={fileName}>
        {isDirty && <span className="tb-dirty">●</span>}
        {fileName}
      </span>

      <span className="tb-spacer" />

      <button
        className="tb-btn tb-btn--icon"
        onClick={onPrefs}
        title="Preferências (Ctrl+,)"
        aria-label="Preferências"
      >
        <TbIconGear />
      </button>
    </div>
  )
}

function TbIconHamburger() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="4"    width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="2" y="10.5" width="12" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  )
}

function TbIconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
