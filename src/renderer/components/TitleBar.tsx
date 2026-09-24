import React, { useState, useEffect, useCallback, useRef } from 'react'
import { NOTIFY } from '@shared/types'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

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
  locale:   Locale
}

interface MenuItem {
  label:        string
  accelerator?: string
  action?:      string
  payload?:     unknown
  separator?:   boolean
  disabled?:    boolean
}

function buildMenus(locale: Locale): { label: string; items: MenuItem[] }[] {
  return [
    {
      label: t('menu.file', locale),
      items: [
        { label: t('menu.fileNew',       locale), accelerator: 'Ctrl+N',       action: 'file:new' },
        { label: t('menu.fileCloseTab',  locale), accelerator: 'Ctrl+W',       action: 'tab:close' },
        { label: '', separator: true },
        { label: t('menu.fileOpen',      locale), accelerator: 'Ctrl+O',       action: 'file:open' },
        { label: t('menu.fileOpenQuick', locale), accelerator: 'Ctrl+P',       action: 'ui:open-quickly' },
        { label: '', separator: true },
        { label: t('menu.fileSave',      locale), accelerator: 'Ctrl+S',       action: 'file:save' },
        { label: t('menu.fileSaveAs',    locale), accelerator: 'Ctrl+Shift+S', action: 'file:save-as' },
        { label: '', separator: true },
        { label: t('menu.fileExportPdf', locale), accelerator: 'Ctrl+Shift+E', action: 'ui:export-pdf' },
        { label: t('menu.fileExportHtml',locale),                               action: 'ui:export-html' },
        { label: '', separator: true },
        { label: t('menu.filePrefs',     locale), accelerator: 'Ctrl+,',       action: 'ui:preferences' },
        { label: '', separator: true },
        { label: t('menu.fileQuit',      locale), accelerator: 'Alt+F4',       action: 'app:quit' },
      ],
    },
    {
      label: t('menu.edit', locale),
      items: [
        { label: t('menu.editUndo',        locale), accelerator: 'Ctrl+Z',       action: 'edit:undo' },
        { label: t('menu.editRedo',        locale), accelerator: 'Ctrl+Shift+Z', action: 'edit:redo' },
        { label: '', separator: true },
        { label: t('menu.editCut',         locale), accelerator: 'Ctrl+X',       action: 'edit:cut' },
        { label: t('menu.editCopy',        locale), accelerator: 'Ctrl+C',       action: 'edit:copy' },
        { label: t('menu.editPaste',       locale), accelerator: 'Ctrl+V',       action: 'edit:paste' },
        { label: '', separator: true },
        { label: t('menu.editSelectAll',   locale), accelerator: 'Ctrl+A',       action: 'edit:select-all' },
        { label: '', separator: true },
        { label: t('menu.editFind',        locale), accelerator: 'Ctrl+F',       action: 'ui:find' },
        { label: t('menu.editReplace',     locale), accelerator: 'Ctrl+H',       action: 'ui:replace' },
        { label: t('menu.editFindInFiles', locale), accelerator: 'Ctrl+Shift+F', action: 'ui:global-search' },
      ],
    },
    {
      label: t('menu.format', locale),
      items: [
        { label: t('menu.fmtBold',          locale), accelerator: 'Ctrl+B',       action: 'format:bold' },
        { label: t('menu.fmtItalic',        locale), accelerator: 'Ctrl+I',       action: 'format:italic' },
        { label: t('menu.fmtStrike',        locale), accelerator: 'Alt+Shift+5',  action: 'format:strikethrough' },
        { label: '', separator: true },
        { label: t('menu.fmtLink',          locale), accelerator: 'Ctrl+K',       action: 'format:link' },
        { label: t('menu.fmtCodeFence',     locale), accelerator: 'Ctrl+Shift+K', action: 'format:code-fence' },
        { label: '', separator: true },
        { label: t('menu.fmtBlockquote',    locale), accelerator: 'Ctrl+Shift+Q', action: 'format:blockquote' },
        { label: t('menu.fmtBulletList',    locale), accelerator: 'Ctrl+Shift+[', action: 'format:bullet-list' },
        { label: t('menu.fmtOrderedList',   locale), accelerator: 'Ctrl+Shift+]', action: 'format:ordered-list' },
        { label: t('menu.fmtTable',         locale), accelerator: 'Ctrl+T',       action: 'format:table' },
        { label: '', separator: true },
        { label: t('menu.fmtH1',            locale), accelerator: 'Ctrl+1',       action: 'format:heading', payload: 1 },
        { label: t('menu.fmtH2',            locale), accelerator: 'Ctrl+2',       action: 'format:heading', payload: 2 },
        { label: t('menu.fmtH3',            locale), accelerator: 'Ctrl+3',       action: 'format:heading', payload: 3 },
        { label: t('menu.fmtParagraph',     locale), accelerator: 'Ctrl+Shift+0', action: 'format:heading', payload: 0 },
      ],
    },
    {
      label: t('menu.view', locale),
      items: [
        { label: t('menu.viewSidebar',    locale), accelerator: 'Ctrl+Shift+L', action: 'view:toggle-sidebar' },
        { label: t('menu.viewSource',     locale), accelerator: 'Ctrl+/',       action: 'view:toggle-source' },
        { label: '', separator: true },
        { label: t('menu.viewFocus',      locale), accelerator: 'F8',           action: 'view:toggle-focus' },
        { label: t('menu.viewTypewriter', locale), accelerator: 'F9',           action: 'view:toggle-typewriter' },
        { label: t('menu.viewFullscreen', locale), accelerator: 'F11',          action: 'view:fullscreen' },
        { label: '', separator: true },
        { label: t('menu.viewZoomIn',     locale), accelerator: 'Ctrl++',       action: 'view:zoom-in' },
        { label: t('menu.viewZoomOut',    locale), accelerator: 'Ctrl+-',       action: 'view:zoom-out' },
        { label: t('menu.viewZoomReset',  locale), accelerator: 'Ctrl+0',       action: 'view:zoom-reset' },
        { label: '', separator: true },
        { label: t('menu.viewReload',     locale), accelerator: 'Ctrl+R',       action: 'view:reload' },
        { label: t('menu.viewDevtools',   locale), accelerator: 'F12',          action: 'view:devtools' },
      ],
    },
    {
      label: t('menu.window', locale),
      items: [
        { label: t('menu.winMinimize', locale), action: 'win:minimize' },
        { label: t('menu.winMaximize', locale), action: 'win:maximize' },
        { label: t('menu.winClose',    locale), accelerator: 'Alt+F4', action: 'win:close' },
      ],
    },
  ]
}

export function TitleBar({ onAction, locale }: TitleBarProps): React.JSX.Element {
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

  const menus = buildMenus(locale)

  return (
    <div className="titlebar" ref={barRef}>
      <div className="titlebar-brand titlebar-drag">
        <RamenIcon />
        <span className="titlebar-appname">TypeShu</span>
      </div>

      <nav className="titlebar-menubar">
        {menus.map((menu, idx) => (
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

      <div className="titlebar-drag titlebar-drag--fill" />

      <div className="titlebar-wincontrols">
        <button className="titlebar-wc-btn titlebar-wc-btn--min"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.api.windowMinimize()}
          title={t('win.minimize', locale)} aria-label={t('win.minimize', locale)}>
          <WcIconMin />
        </button>
        <button className="titlebar-wc-btn titlebar-wc-btn--max"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.api.windowMaximize()}
          title={isMaximized ? t('win.restore', locale) : t('win.maximize', locale)}
          aria-label={isMaximized ? t('win.restore', locale) : t('win.maximize', locale)}>
          {isMaximized ? <WcIconRestore /> : <WcIconMax />}
        </button>
        <button className="titlebar-wc-btn titlebar-wc-btn--close"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.api.windowClose()}
          title={t('win.close', locale)} aria-label={t('win.close', locale)}>
          <WcIconClose />
        </button>
      </div>
    </div>
  )
}

/* ── Ramen icon — solid/filled ───────────────────────────────────────────── */
function RamenIcon() {
  return (
    <svg
      width="18" height="18"
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="58" y="4" width="6" height="44" rx="3"
        transform="rotate(12 61 26)" />
      <rect x="70" y="4" width="6" height="44" rx="3"
        transform="rotate(18 73 26)" />
      <path d="M28 48 A18 18 0 1 1 46 30 A14 14 0 1 0 32 44 A10 10 0 1 1 40 35 A6 6 0 1 0 35 41 Z"
        fillRule="evenodd" />
      <rect x="8" y="52" width="84" height="10" rx="5" />
      <path d="M12 62 Q14 90 50 92 Q86 90 88 62 Z" />
      <rect x="36" y="90" width="28" height="6" rx="3" />
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
