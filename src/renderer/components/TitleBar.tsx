// [mcp-local harness] feature: titlebar-icon-reload | plano: db335314 | 2026-09-18
// +Reload em View menu; +ícone ramen SVG no lugar do T
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { NOTIFY } from '@shared/types'

declare const window: Window & {
  api: {
    windowMinimize:    () => Promise<void>
    windowMaximize:    () => Promise<void>
    windowClose:       () => Promise<void>
    windowIsMaximized: () => Promise<boolean>
    on:                (channel: string, cb: (...args: unknown[]) => void) => void
    removeAllListeners:(channel: string) => void
  }
}

export interface TitleBarProps {
  onAction: (action: string, payload?: unknown) => void
}

interface MenuItem {
  label:        string
  accelerator?: string
  action?:      string
  payload?:     unknown
  separator?:   boolean
  disabled?:    boolean
}

const MENUS: { label: string; items: MenuItem[] }[] = [
  {
    label: 'File',
    items: [
      { label: 'New',               accelerator: 'Ctrl+N',       action: 'file:new' },
      { label: '', separator: true },
      { label: 'Open...',           accelerator: 'Ctrl+O',       action: 'file:open' },
      { label: 'Open Quickly',      accelerator: 'Ctrl+P',       action: 'ui:open-quickly' },
      { label: '', separator: true },
      { label: 'Save',              accelerator: 'Ctrl+S',       action: 'file:save' },
      { label: 'Save As...',        accelerator: 'Ctrl+Shift+S', action: 'file:save-as' },
      { label: '', separator: true },
      { label: 'Export as PDF...',  accelerator: 'Ctrl+Shift+E', action: 'ui:export-pdf' },
      { label: 'Export as HTML...', action: 'ui:export-html' },
      { label: '', separator: true },
      { label: 'Preferences',       accelerator: 'Ctrl+,',       action: 'ui:preferences' },
      { label: '', separator: true },
      { label: 'Quit',              accelerator: 'Alt+F4',       action: 'app:quit' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo',          accelerator: 'Ctrl+Z',       action: 'edit:undo' },
      { label: 'Redo',          accelerator: 'Ctrl+Shift+Z', action: 'edit:redo' },
      { label: '', separator: true },
      { label: 'Cut',           accelerator: 'Ctrl+X',       action: 'edit:cut' },
      { label: 'Copy',          accelerator: 'Ctrl+C',       action: 'edit:copy' },
      { label: 'Paste',         accelerator: 'Ctrl+V',       action: 'edit:paste' },
      { label: '', separator: true },
      { label: 'Select All',    accelerator: 'Ctrl+A',       action: 'edit:select-all' },
      { label: '', separator: true },
      { label: 'Find',          accelerator: 'Ctrl+F',       action: 'ui:find' },
      { label: 'Replace',       accelerator: 'Ctrl+H',       action: 'ui:replace' },
      { label: 'Find in Files', accelerator: 'Ctrl+Shift+F', action: 'ui:global-search' },
    ],
  },
  {
    label: 'Format',
    items: [
      { label: 'Bold',          accelerator: 'Ctrl+B',       action: 'format:bold' },
      { label: 'Italic',        accelerator: 'Ctrl+I',       action: 'format:italic' },
      { label: 'Strikethrough', accelerator: 'Alt+Shift+5',  action: 'format:strikethrough' },
      { label: '', separator: true },
      { label: 'Hyperlink',     accelerator: 'Ctrl+K',       action: 'format:link' },
      { label: 'Code Fence',    accelerator: 'Ctrl+Shift+K', action: 'format:code-fence' },
      { label: '', separator: true },
      { label: 'Blockquote',    accelerator: 'Ctrl+Shift+Q', action: 'format:blockquote' },
      { label: 'Bullet List',   accelerator: 'Ctrl+Shift+[', action: 'format:bullet-list' },
      { label: 'Ordered List',  accelerator: 'Ctrl+Shift+]', action: 'format:ordered-list' },
      { label: 'Table',         accelerator: 'Ctrl+T',       action: 'format:table' },
      { label: '', separator: true },
      { label: 'Heading 1',     accelerator: 'Ctrl+1',       action: 'format:heading', payload: 1 },
      { label: 'Heading 2',     accelerator: 'Ctrl+2',       action: 'format:heading', payload: 2 },
      { label: 'Heading 3',     accelerator: 'Ctrl+3',       action: 'format:heading', payload: 3 },
      { label: 'Paragraph',     accelerator: 'Ctrl+Shift+0', action: 'format:heading', payload: 0 },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle Sidebar',    accelerator: 'Ctrl+Shift+L', action: 'view:toggle-sidebar' },
      { label: 'Source Code Mode',  accelerator: 'Ctrl+/',       action: 'view:toggle-source' },
      { label: '', separator: true },
      { label: 'Focus Mode',        accelerator: 'F8',           action: 'view:toggle-focus' },
      { label: 'Typewriter Mode',   accelerator: 'F9',           action: 'view:toggle-typewriter' },
      { label: 'Toggle Fullscreen', accelerator: 'F11',          action: 'view:fullscreen' },
      { label: '', separator: true },
      { label: 'Zoom In',           accelerator: 'Ctrl++',       action: 'view:zoom-in' },
      { label: 'Zoom Out',          accelerator: 'Ctrl+-',       action: 'view:zoom-out' },
      { label: 'Reset Zoom',        accelerator: 'Ctrl+0',       action: 'view:zoom-reset' },
      { label: '', separator: true },
      { label: 'Reload',            accelerator: 'Ctrl+R',       action: 'view:reload' },
      { label: 'Toggle DevTools',   accelerator: 'F12',          action: 'view:devtools' },
    ],
  },
  {
    label: 'Window',
    items: [
      { label: 'Minimize', action: 'win:minimize' },
      { label: 'Maximize', action: 'win:maximize' },
      { label: 'Close',    accelerator: 'Alt+F4', action: 'win:close' },
    ],
  },
]

export function TitleBar({ onAction }: TitleBarProps): React.JSX.Element {
  const [openMenu, setOpenMenu]       = useState<number | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.windowIsMaximized().then(setIsMaximized).catch(() => {})
    window.api.on(NOTIFY.WIN_MAXIMIZED_CHANGED, (...args: unknown[]) => {
      setIsMaximized(args[0] as boolean)
    })
    return () => window.api.removeAllListeners(NOTIFY.WIN_MAXIMIZED_CHANGED)
  }, [])

  useEffect(() => {
    if (openMenu === null) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  const handleItem = useCallback((item: MenuItem) => {
    if (!item.action || item.separator) return
    setOpenMenu(null)
    onAction(item.action, item.payload)
  }, [onAction])

  const handleMenuMouseEnter = useCallback((idx: number) => {
    if (openMenu !== null) setOpenMenu(idx)
  }, [openMenu])

  return (
    <div className="titlebar" ref={barRef}>
      {/* Ícone ramen + nome — drag region */}
      <div className="titlebar-brand titlebar-drag">
        <RamenIcon />
        <span className="titlebar-appname">TypeShu</span>
      </div>

      {/* Menu bar */}
      <nav className="titlebar-menubar">
        {MENUS.map((menu, idx) => (
          <div key={menu.label} className="titlebar-menu-wrap">
            <button
              className={`titlebar-menu-btn${openMenu === idx ? ' titlebar-menu-btn--open' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setOpenMenu(openMenu === idx ? null : idx) }}
              onMouseEnter={() => handleMenuMouseEnter(idx)}
            >
              {menu.label}
            </button>
            {openMenu === idx && (
              <div className="titlebar-dropdown">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <div key={i} className="titlebar-dropdown-sep" />
                  ) : (
                    <button
                      key={i}
                      className="titlebar-dropdown-item"
                      onMouseDown={(e) => { e.preventDefault(); handleItem(item) }}
                      disabled={item.disabled}
                    >
                      <span className="titlebar-dropdown-label">{item.label}</span>
                      {item.accelerator && (
                        <span className="titlebar-dropdown-accel">{item.accelerator}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Drag region central */}
      <div className="titlebar-drag titlebar-drag--fill" />

      {/* Window controls */}
      <div className="titlebar-wincontrols">
        <button className="titlebar-wc-btn titlebar-wc-btn--min"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.api.windowMinimize()}
          title="Minimizar" aria-label="Minimizar">
          <WcIconMin />
        </button>
        <button className="titlebar-wc-btn titlebar-wc-btn--max"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.api.windowMaximize()}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}>
          {isMaximized ? <WcIconRestore /> : <WcIconMax />}
        </button>
        <button className="titlebar-wc-btn titlebar-wc-btn--close"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.api.windowClose()}
          title="Fechar" aria-label="Fechar">
          <WcIconClose />
        </button>
      </div>
    </div>
  )
}

/* ── Ramen icon ──────────────────────────────────────────────────────────── */
function RamenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true"
      style={{ flexShrink: 0 }} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {/* Hashis */}
      <rect x="8" y="6" width="48" height="5" rx="2.5" strokeWidth="2" fill="none"/>
      <line x1="14" y1="11" x2="10" y2="30" strokeWidth="2"/>
      {/* Macarrão — 4 curvas */}
      <path d="M20 11 Q22 20 18 28" strokeWidth="2" fill="none"/>
      <path d="M26 11 Q28 20 24 28" strokeWidth="2" fill="none"/>
      <path d="M32 11 Q34 20 30 28" strokeWidth="2" fill="none"/>
      <path d="M38 11 Q40 20 36 28" strokeWidth="2" fill="none"/>
      {/* Ovo */}
      <ellipse cx="16" cy="28" rx="7" ry="6" strokeWidth="2" fill="none"/>
      <circle cx="16" cy="28" r="3" strokeWidth="1.5" fill="none"/>
      {/* Tigela — borda */}
      <path d="M6 34 H58" strokeWidth="2.5"/>
      <path d="M8 34 Q10 56 32 60 Q54 56 56 34" strokeWidth="2" fill="none"/>
      {/* Pézinhos da tigela */}
      <line x1="24" y1="60" x2="20" y2="64" strokeWidth="2"/>
      <line x1="40" y1="60" x2="44" y2="64" strokeWidth="2"/>
      <line x1="20" y1="63" x2="44" y2="63" strokeWidth="2"/>
      {/* Pontinhos decorativos na tigela */}
      <circle cx="18" cy="44" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="26" cy="48" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="34" cy="50" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="42" cy="48" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

/* ── Window control icons ────────────────────────────────────────────────── */
function WcIconMin() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="0" y="4.5" width="10" height="1" fill="currentColor"/>
    </svg>
  )
}

function WcIconMax() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none"/>
    </svg>
  )
}

function WcIconRestore() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="none"/>
      <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="var(--bg-chrome)"/>
    </svg>
  )
}

function WcIconClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
