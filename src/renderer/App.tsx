import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MilkdownAdapter, EditorHandle } from './editor/MilkdownAdapter'
import { setFindOpener, setReplaceOpener } from './editor/shortcutPlugin'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { TitleBar } from './components/TitleBar'
import { ActivityBar } from './components/ActivityBar'
import { TabBar } from './components/TabBar'
import { FloatingToolbar } from './components/FloatingToolbar'
import { FrontMatterPanel, extractFrontMatter } from './components/FrontMatterPanel'
import { QuickOpen } from './components/QuickOpen'
import { GlobalSearch } from './components/GlobalSearch'
import { LinkDialog } from './components/LinkDialog'
import { FindBar } from './components/FindBar'
import { PrefsPanel } from './components/PrefsPanel'
import { IPC, NOTIFY, DEFAULT_PREFERENCES, type UserPreferences, type RecentFile, type TabState } from '@shared/types'

const AUTO_SAVE_INTERVAL_DEFAULT = 30_000

const WELCOME_MD = `# Bem-vindo ao TypeShu

Este é um editor Markdown com **live preview** — o que você digita é renderizado instantaneamente.

## Começando

- Abra um arquivo com \`Ctrl+O\`
- Busca rápida com \`Ctrl+P\`
- Busca no documento com \`Ctrl+F\`
- Substituir no documento com \`Ctrl+H\`
- Busca em arquivos com \`Ctrl+Shift+F\`
- Toggle sidebar com \`Ctrl+Shift+L\`
- Salve com \`Ctrl+S\`
- Preferências com \`Ctrl+,\`

## Formatação

| Ação | Atalho |
|---|---|
| **Negrito** | Ctrl+B |
| *Itálico* | Ctrl+I |
| ~~Riscado~~ | Alt+Shift+5 |
| [Link](#) | Ctrl+K |
| Código | Ctrl+Shift+K |
| > Blockquote | Ctrl+Shift+Q |
| Bullet list | Ctrl+Shift+[ |
| Ordered list | Ctrl+Shift+] |
| Tabela | Ctrl+T |

> Comece a digitar aqui ou abra um arquivo existente.
`

declare const window: Window & {
  api: {
    openFile:    () => Promise<{ success: boolean; path?: string; content?: string }>
    openPath:    (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
    saveFile:    (path: string, content: string) => Promise<{ success: boolean }>
    saveFileAs:  (content: string) => Promise<{ success: boolean; path?: string }>
    watchStart:  (path: string) => Promise<{ success: boolean }>
    watchStop:   () => Promise<{ success: boolean }>
    newFile:     (dirPath: string, fileName: string) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>
    renameFile:  (oldPath: string, newName: string)  => Promise<{ success: boolean; newPath?: string; error?: string }>
    deleteFile:  (filePath: string) => Promise<{ success: boolean; error?: string }>
    getPrefs:    () => Promise<UserPreferences>
    setPrefs:    (p: Partial<UserPreferences>) => Promise<UserPreferences>
    getRecent:   () => Promise<RecentFile[]>
    addRecent:   (filePath: string) => Promise<RecentFile[]>
    windowMinimize:    () => Promise<void>
    windowMaximize:    () => Promise<void>
    windowClose:       () => Promise<void>
    windowIsMaximized: () => Promise<boolean>
    on:          (channel: string, cb: (...args: unknown[]) => void) => void
    removeAllListeners: (channel: string) => void
  }
}

function applyPrefsToCSS(prefs: UserPreferences) {
  const root = document.documentElement
  root.style.setProperty('--font-editor', prefs.fontFamily)
  root.style.setProperty('--font-size',   `${prefs.fontSize}px`)
  root.style.setProperty('--line-height', String(prefs.lineHeight))
  if (prefs.theme === 'dark')        root.setAttribute('data-theme', 'dark')
  else if (prefs.theme === 'light')  root.setAttribute('data-theme', 'light')
  else                               root.removeAttribute('data-theme')
}

function countWords(t: string) { return t.trim() === '' ? 0 : t.trim().split(/\s+/).length }
function countChars(t: string) { return t.replace(/\r\n/g, '\n').length }
function readingTime(w: number) { const m = Math.ceil(w / 200); return m <= 1 ? '< 1 min' : `${m} min` }

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function makeUntitledTab(): TabState {
  return { id: makeId(), filePath: null, content: '', isDirty: false, scrollTop: 0 }
}

interface StatusBarProps { content: string; filePath: string | null; isDirty: boolean; autoSaved: boolean }
function StatusBar({ content, filePath, isDirty, autoSaved }: StatusBarProps): React.JSX.Element {
  const words = countWords(content); const chars = countChars(content); const time = readingTime(words)
  const name = filePath ? filePath.split(/[\\/]/).pop() : 'Sem título'
  return (
    <div className="status-bar">
      <span className="status-file">
        {isDirty ? '● ' : ''}{name}
        {autoSaved && <span className="status-autosaved"> ✓ salvo</span>}
      </span>
      <span className="status-counts">{words.toLocaleString()} palavras · {chars.toLocaleString()} chars · {time}</span>
    </div>
  )
}

interface ExternalChangeBannerProps { onReload: () => void; onDismiss: () => void }
function ExternalChangeBanner({ onReload, onDismiss }: ExternalChangeBannerProps): React.JSX.Element {
  return (
    <div className="external-change-banner">
      <span className="external-change-msg">⚠ Arquivo modificado externamente.</span>
      <button className="external-change-btn external-change-btn--primary" onClick={onReload}>Recarregar</button>
      <button className="external-change-btn" onClick={onDismiss}>Ignorar</button>
    </div>
  )
}

function exportHTML(fileName: string): void {
  const editor = document.querySelector('.ProseMirror'); if (!editor) return
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${fileName}</title>
<style>body{max-width:800px;margin:40px auto;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1a1a1a;padding:0 24px}
h1,h2,h3,h4,h5,h6{font-family:-apple-system,sans-serif;font-weight:600;margin:1.2em 0 0.4em}h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}
code{font-family:monospace;background:#f3f3f3;padding:.1em .4em;border-radius:3px}pre{background:#f3f3f3;padding:1em;overflow-x:auto;border-radius:4px}pre code{background:none;padding:0}
blockquote{border-left:3px solid #e0e0e0;padding-left:1em;color:#6b6b6b;margin:.75em 0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e0e0e0;padding:.5em .75em}
th{background:#f3f3f3;font-weight:600}a{color:#4a90d9}del{text-decoration:line-through;color:#888}</style>
</head><body>${editor.innerHTML}</body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: fileName.replace(/\.(md|markdown|txt)$/i, '') + '.html' })
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function App(): React.JSX.Element {
  const initialTab = makeUntitledTab()
  const [tabs, setTabs]               = useState<TabState[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id)
  const [editorKey, setEditorKey]     = useState(0)
  const [initialContent, setInitialContent] = useState(WELCOME_MD)

  const [sidebarOpen, setSidebarOpen]                 = useState(false)
  const [focusMode, setFocusMode]                     = useState(false)
  const [typewriterMode, setTypewriterMode]           = useState(false)
  const [sourceMode, setSourceMode]                   = useState(false)
  const [wordCountContent, setWordCountContent]       = useState(WELCOME_MD)
  const [frontMatter, setFrontMatter]                 = useState<string | null>(null)
  const [outlineMarkdown, setOutlineMarkdown]         = useState(WELCOME_MD)
  const [quickOpenVisible, setQuickOpenVisible]       = useState(false)
  const [globalSearchVisible, setGlobalSearchVisible] = useState(false)
  const [currentDirPath, setCurrentDirPath]           = useState<string | null>(null)
  const [autoSaved, setAutoSaved]                     = useState(false)
  const [externalChanged, setExternalChanged]         = useState(false)
  const [linkDialogVisible, setLinkDialogVisible]     = useState(false)
  const [linkInitialLabel, setLinkInitialLabel]       = useState('')
  const [findVisible, setFindVisible]                 = useState(false)
  const [findReplace, setFindReplace]                 = useState(false)
  const [findMatches, setFindMatches]                 = useState(0)
  const [findCurrent, setFindCurrent]                 = useState(-1)
  const [prefs, setPrefs]                             = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [prefsVisible, setPrefsVisible]               = useState(false)
  const [recentFiles, setRecentFiles]                 = useState<RecentFile[]>([])

  const tabsRef             = useRef<TabState[]>([initialTab])
  const activeTabIdRef      = useRef<string>(initialTab.id)
  const editorContentRef    = useRef<string>('')
  const autoSaveIntervalRef = useRef(AUTO_SAVE_INTERVAL_DEFAULT)
  const editorRef           = useRef<EditorHandle>(null)
  const milkdownContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { tabsRef.current = tabs },               [tabs])
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  function getActiveTab(): TabState | undefined {
    return tabsRef.current.find(t => t.id === activeTabIdRef.current)
  }

  function captureScroll(): number {
    const el = milkdownContainerRef.current
    return el ? el.scrollTop : 0
  }

  function mountTab(tab: TabState) {
    const fm = extractFrontMatter(tab.content)
    const editorMd = fm ? fm.body : tab.content
    editorContentRef.current = tab.content
    setInitialContent(editorMd || '')
    setEditorKey(k => k + 1)
    setFrontMatter(fm ? fm.content : null)
    setOutlineMarkdown(editorMd || '')
    setWordCountContent(tab.content)
    setSourceMode(false)
    setExternalChanged(false)
    setAutoSaved(false)
    setTimeout(() => {
      if (milkdownContainerRef.current) milkdownContainerRef.current.scrollTop = tab.scrollTop
    }, 80)
  }

  useEffect(() => {
    window.api.getPrefs().then(p => {
      const merged = { ...DEFAULT_PREFERENCES, ...p }
      setPrefs(merged); applyPrefsToCSS(merged)
      autoSaveIntervalRef.current = (merged.autoSaveInterval ?? 30) * 1000
    }).catch(() => {})
    window.api.getRecent().then(setRecentFiles).catch(() => {})
  }, [])

  const handlePrefsChange = useCallback((newPrefs: UserPreferences) => {
    setPrefs(newPrefs); applyPrefsToCSS(newPrefs)
    autoSaveIntervalRef.current = (newPrefs.autoSaveInterval ?? 30) * 1000
  }, [])

  const handlePrefsClose = useCallback(async () => {
    setPrefsVisible(false)
    await window.api.setPrefs(prefs as any)
  }, [prefs])

  useEffect(() => {
    setFindOpener(() => { setFindReplace(false); setFindVisible(true) })
    setReplaceOpener(() => { setFindReplace(true); setFindVisible(true) })
    return () => { setFindOpener(() => {}); setReplaceOpener(() => {}) }
  }, [])

  const openFind    = useCallback(() => { setFindReplace(false); setFindVisible(true) }, [])
  const openReplace = useCallback(() => { setFindReplace(true);  setFindVisible(true) }, [])

  const closeFind = useCallback(() => {
    setFindVisible(false); editorRef.current?.clearFind()
    setFindMatches(0); setFindCurrent(-1)
  }, [])

  const handleFindState = useCallback((matches: number, current: number) => {
    setFindMatches(matches); setFindCurrent(current)
    setTimeout(() => editorRef.current?.scrollToCurrentMatch(), 0)
  }, [])

  const handleFind       = useCallback((q: string, cs: boolean) => editorRef.current?.find(q, cs), [])
  const handleFindNext   = useCallback(() => editorRef.current?.findNext(), [])
  const handleFindPrev   = useCallback(() => editorRef.current?.findPrev(), [])
  const handleReplaceOne = useCallback((r: string) => editorRef.current?.replaceOne(r), [])
  const handleReplaceAll = useCallback((r: string) => editorRef.current?.replaceAll(r), [])

  const openInTab = useCallback(async (path: string, content: string) => {
    const existing = tabsRef.current.find(t => t.filePath === path)
    if (existing) {
      const scroll = captureScroll()
      setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, scrollTop: scroll } : t))
      setActiveTabId(existing.id)
      activeTabIdRef.current = existing.id
      mountTab(existing)
      return
    }
    const scroll = captureScroll()
    const newTab: TabState = { id: makeId(), filePath: path, content, isDirty: false, scrollTop: 0 }
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabIdRef.current ? { ...t, scrollTop: scroll } : t)
      return [...updated, newTab]
    })
    setActiveTabId(newTab.id)
    activeTabIdRef.current = newTab.id
    window.api.watchStop()
    window.api.watchStart(path)
    const updated = await window.api.addRecent(path)
    setRecentFiles(updated)
    mountTab(newTab)
    setCurrentDirPath(path.replace(/[\\/][^\\/]+$/, ''))
  }, [])

  const switchTab = useCallback((id: string) => {
    if (id === activeTabIdRef.current) return
    const scroll = captureScroll()
    setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, scrollTop: scroll } : t))
    setActiveTabId(id)
    activeTabIdRef.current = id
    const tab = tabsRef.current.find(t => t.id === id)
    if (tab) {
      mountTab(tab)
      if (tab.filePath) {
        window.api.watchStop()
        window.api.watchStart(tab.filePath)
        setCurrentDirPath(tab.filePath.replace(/[\\/][^\\/]+$/, ''))
      }
    }
  }, [])

  const closeTab = useCallback((id: string) => {
    const target = tabsRef.current.find(t => t.id === id)
    if (!target) return

    const doClose = () => {
      setTabs(prev => {
        const remaining = prev.filter(t => t.id !== id)
        if (activeTabIdRef.current === id) {
          if (remaining.length === 0) {
            const blank = makeUntitledTab()
            setActiveTabId(blank.id)
            activeTabIdRef.current = blank.id
            mountTab(blank)
            return [blank]
          }
          const idx = prev.findIndex(t => t.id === id)
          const next = remaining[Math.max(0, idx - 1)]
          setActiveTabId(next.id)
          activeTabIdRef.current = next.id
          mountTab(next)
          if (next.filePath) {
            window.api.watchStop()
            window.api.watchStart(next.filePath)
          } else {
            window.api.watchStop()
          }
        }
        return remaining
      })
    }

    if (target.isDirty) {
      const name = target.filePath ? target.filePath.split(/[\\/]/).pop() : 'Untitled'
      const save = confirm(`"${name}" tem alterações não salvas.\nSalvar antes de fechar?`)
      if (save) {
        if (target.filePath) {
          window.api.saveFile(target.filePath, target.content).then(r => { if (r.success) doClose() })
        } else {
          window.api.saveFileAs(target.content).then(r => { if (r.success) doClose() })
        }
      } else {
        doClose()
      }
    } else {
      doClose()
    }
  }, [])

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const openNewTab = useCallback(() => {
    const scroll = captureScroll()
    setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, scrollTop: scroll } : t))
    const blank = makeUntitledTab()
    setTabs(prev => [...prev, blank])
    setActiveTabId(blank.id)
    activeTabIdRef.current = blank.id
    mountTab(blank)
    window.api.watchStop()
  }, [])

  const handleChange = useCallback((md: string) => {
    const fm = extractFrontMatter(editorContentRef.current)
    const full = fm ? `---\n${fm.content}\n---\n${md}` : md
    editorContentRef.current = full
    setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, content: full, isDirty: true } : t))
    setWordCountContent(full)
    setOutlineMarkdown(md)
    setAutoSaved(false)
  }, [])

  const handleDirChange = useCallback((dir: string) => setCurrentDirPath(dir), [])

  const handleFileDelete = useCallback((deletedPath: string) => {
    const tab = tabsRef.current.find(t => t.filePath === deletedPath)
    if (tab) {
      setTabs(prev => {
        const remaining = prev.filter(t => t.filePath !== deletedPath)
        if (activeTabIdRef.current === tab.id) {
          if (remaining.length === 0) {
            const blank = makeUntitledTab()
            setActiveTabId(blank.id)
            activeTabIdRef.current = blank.id
            mountTab(blank)
            return [blank]
          }
          const idx = prev.findIndex(t => t.id === tab.id)
          const next = remaining[Math.max(0, idx - 1)]
          setActiveTabId(next.id)
          activeTabIdRef.current = next.id
          mountTab(next)
        }
        return remaining
      })
      window.api.watchStop()
    }
  }, [])

  const handleFileRename = useCallback((oldPath: string, newPath: string) => {
    setTabs(prev => prev.map(t => t.filePath === oldPath ? { ...t, filePath: newPath } : t))
    const active = getActiveTab()
    if (active?.filePath === oldPath) window.api.watchStart(newPath)
  }, [])

  const handleSaveAs = useCallback(async () => {
    const r = await window.api.saveFileAs(editorContentRef.current)
    if (r.success && r.path) {
      const path = r.path
      setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, filePath: path, isDirty: false } : t))
      window.api.watchStart(path)
      setAutoSaved(true); setTimeout(() => setAutoSaved(false), 2000)
    }
  }, [])

  const handleSave = useCallback(async () => {
    const tab = getActiveTab()
    if (!tab) return
    if (!tab.filePath) return handleSaveAs()
    const r = await window.api.saveFile(tab.filePath, editorContentRef.current)
    if (r.success) {
      setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, isDirty: false } : t))
      setAutoSaved(true); setTimeout(() => setAutoSaved(false), 2000)
    }
  }, [handleSaveAs])

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!prefs.autoSave) return
      const dirtyTabs = tabsRef.current.filter(t => t.isDirty && t.filePath)
      for (const t of dirtyTabs) {
        const content = t.id === activeTabIdRef.current ? editorContentRef.current : t.content
        const r = await window.api.saveFile(t.filePath!, content)
        if (r.success) {
          setTabs(prev => prev.map(tab => tab.id === t.id ? { ...tab, isDirty: false } : tab))
          if (t.id === activeTabIdRef.current) {
            setAutoSaved(true); setTimeout(() => setAutoSaved(false), 3000)
          }
        }
      }
    }, autoSaveIntervalRef.current)
    return () => clearInterval(timer)
  }, [prefs.autoSave, prefs.autoSaveInterval])

  useEffect(() => {
    window.api.on(NOTIFY.FILE_CHANGED_EXTERNALLY, () => setExternalChanged(true))
    return () => window.api.removeAllListeners(NOTIFY.FILE_CHANGED_EXTERNALLY)
  }, [])

  const handleReloadExternal = useCallback(async () => {
    const tab = getActiveTab()
    if (!tab?.filePath) return
    const r = await window.api.openPath(tab.filePath)
    if (r.success && r.content !== undefined && r.path) {
      const content = r.content
      setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, content, isDirty: false } : t))
      const fm = extractFrontMatter(content)
      editorContentRef.current = content
      setInitialContent(fm ? fm.body : content)
      setEditorKey(k => k + 1)
      setFrontMatter(fm ? fm.content : null)
      setOutlineMarkdown(fm ? fm.body : content)
      setWordCountContent(content)
    }
    setExternalChanged(false)
  }, [])

  useEffect(() => {
    window.api.on('file:opened', (...args: unknown[]) => {
      const r = args[0] as { success: boolean; path?: string; content?: string }
      if (r.success && r.content !== undefined && r.path) openInTab(r.path, r.content)
    })
    return () => window.api.removeAllListeners('file:opened')
  }, [openInTab])

  useEffect(() => {
    window.api.on('recent:open', async (...args: unknown[]) => {
      const path = args[0] as string
      const updated = await window.api.addRecent(path)
      setRecentFiles(updated)
    })
    return () => window.api.removeAllListeners('recent:open')
  }, [])

  useEffect(() => {
    window.api.on(NOTIFY.RECENT_CHANGED, (...args: unknown[]) => {
      setRecentFiles(args[0] as RecentFile[])
    })
    return () => window.api.removeAllListeners(NOTIFY.RECENT_CHANGED)
  }, [])

  useEffect(() => {
    window.api.on(IPC.FILE_SAVE,    () => handleSave())
    window.api.on(IPC.FILE_SAVE_AS, () => handleSaveAs())
    window.api.on(IPC.FILE_NEW,     () => openNewTab())
    return () => { [IPC.FILE_SAVE, IPC.FILE_SAVE_AS, IPC.FILE_NEW].forEach(ch => window.api.removeAllListeners(ch)) }
  }, [handleSave, handleSaveAs, openNewTab])

  const openLinkDialog = useCallback(() => {
    const selected = editorRef.current?.getSelectedText() ?? ''
    setLinkInitialLabel(selected); setLinkDialogVisible(true)
  }, [])

  const handleLinkConfirm = useCallback((label: string, url: string) => {
    editorRef.current?.replaceSelectionWith(`[${label}](${url})`); setLinkDialogVisible(false)
  }, [])

  const handleInlineCode = useCallback(() => {
    const sel = editorRef.current?.getSelectedText() ?? ''
    editorRef.current?.replaceSelectionWith(sel ? `\`${sel}\`` : '``')
  }, [])

  const handleTitleBarAction = useCallback((action: string, payload?: unknown) => {
    const activeTab = getActiveTab()
    switch (action) {
      case 'file:new':          openNewTab(); break
      case 'tab:close':         closeTab(activeTabIdRef.current); break
      case 'file:open':         window.api.openFile().then(r => { if (r.success && r.path && r.content !== undefined) openInTab(r.path, r.content) }); break
      case 'file:save':         handleSave(); break
      case 'file:save-as':      handleSaveAs(); break
      case 'ui:open-quickly':   setQuickOpenVisible(true); break
      case 'ui:global-search':  setGlobalSearchVisible(true); setSidebarOpen(true); break
      case 'ui:export-pdf':     window.print(); break
      case 'ui:export-html':    exportHTML(activeTab?.filePath?.split(/[\\/]/).pop() ?? 'documento'); break
      case 'ui:preferences':    setPrefsVisible(true); break
      case 'ui:find':           openFind(); break
      case 'ui:replace':        openReplace(); break
      case 'format:bold':       editorRef.current?.toggleBold(); break
      case 'format:italic':     editorRef.current?.toggleItalic(); break
      case 'format:strikethrough': editorRef.current?.toggleStrikethrough(); break
      case 'format:link':       openLinkDialog(); break
      case 'format:code-fence': editorRef.current?.insertCodeFence(); break
      case 'format:blockquote': editorRef.current?.toggleBlockquote(); break
      case 'format:bullet-list':  editorRef.current?.toggleBulletList(); break
      case 'format:ordered-list': editorRef.current?.toggleOrderedList(); break
      case 'format:table':      editorRef.current?.insertTable(); break
      case 'format:heading':    editorRef.current?.setHeading((payload as 0|1|2|3|4|5|6) ?? 0); break
      case 'view:toggle-sidebar':    setSidebarOpen(v => !v); break
      case 'view:toggle-source':     setSourceMode(v => !v); break
      case 'view:toggle-focus':      setFocusMode(v => !v); break
      case 'view:toggle-typewriter': setTypewriterMode(v => !v); break
      case 'view:reload':       window.location.reload(); break
      case 'view:fullscreen':
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
        else document.exitFullscreen().catch(() => {})
        break
      case 'view:zoom-in':    document.documentElement.style.zoom = String(Math.min(2, parseFloat(document.documentElement.style.zoom || '1') + 0.1)); break
      case 'view:zoom-out':   document.documentElement.style.zoom = String(Math.max(0.5, parseFloat(document.documentElement.style.zoom || '1') - 0.1)); break
      case 'view:zoom-reset': document.documentElement.style.zoom = '1'; break
      case 'win:minimize':    window.api.windowMinimize(); break
      case 'win:maximize':    window.api.windowMaximize(); break
      case 'win:close':       window.api.windowClose(); break
      case 'app:quit':        window.api.windowClose(); break
      case 'edit:undo':       document.execCommand('undo'); break
      case 'edit:redo':       document.execCommand('redo'); break
      case 'edit:cut':        document.execCommand('cut'); break
      case 'edit:copy':       document.execCommand('copy'); break
      case 'edit:paste':      document.execCommand('paste'); break
      case 'edit:select-all': document.execCommand('selectAll'); break
    }
  }, [openNewTab, closeTab, openInTab, handleSave, handleSaveAs, openFind, openReplace, openLinkDialog])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey; const shift = e.shiftKey; const alt = e.altKey
    const key = e.key.toLowerCase(); const code = e.code

    if (ctrl && !shift && !alt && key === 'b') { e.preventDefault(); editorRef.current?.toggleBold(); return }
    if (ctrl && !shift && !alt && key === 'i') { e.preventDefault(); editorRef.current?.toggleItalic(); return }
    if (alt && shift && !ctrl && (code === 'Digit5' || code === 'Numpad5')) { e.preventDefault(); editorRef.current?.toggleStrikethrough(); return }
    if (ctrl && shift && !alt && key === 'q') { e.preventDefault(); editorRef.current?.toggleBlockquote(); return }
    if (ctrl && shift && !alt && (key === '[' || code === 'BracketLeft'))  { e.preventDefault(); editorRef.current?.toggleBulletList(); return }
    if (ctrl && shift && !alt && (key === ']' || code === 'BracketRight')) { e.preventDefault(); editorRef.current?.toggleOrderedList(); return }
    if (ctrl && !shift && !alt && key === 't') { e.preventDefault(); editorRef.current?.insertTable(); return }
    if (ctrl && !shift && !alt && key === 'k') { e.preventDefault(); openLinkDialog(); return }
    if (ctrl && shift && !alt && key === 'k')  { e.preventDefault(); editorRef.current?.insertCodeFence(); return }
    if (ctrl && !shift && !alt && key === 'f') { e.preventDefault(); openFind(); return }
    if (ctrl && !shift && !alt && key === 'h') { e.preventDefault(); openReplace(); return }
    if (ctrl && !shift && !alt && key === ',') { e.preventDefault(); setPrefsVisible(true); return }
    if (ctrl && !shift && !alt && key >= '1' && key <= '6') { e.preventDefault(); editorRef.current?.setHeading(Number(key) as 1|2|3|4|5|6); return }
    if (ctrl && shift && !alt && key === '0') { e.preventDefault(); editorRef.current?.setHeading(0); return }
    if (ctrl && !shift && !alt && key === '/') { e.preventDefault(); setSourceMode(v => !v); return }
    if (ctrl && shift && !alt && key === 'l')  { e.preventDefault(); setSidebarOpen(v => !v); return }
    if (ctrl && !shift && !alt && key === 'r') { e.preventDefault(); window.location.reload(); return }
    if (ctrl && !shift && !alt && key === 's') { e.preventDefault(); handleSave(); return }
    if (ctrl && shift && !alt && key === 's')  { e.preventDefault(); handleSaveAs(); return }
    if (ctrl && !shift && !alt && key === 'p') { e.preventDefault(); setQuickOpenVisible(true); return }
    if (ctrl && !shift && !alt && key === 'n') { e.preventDefault(); openNewTab(); return }
    if (ctrl && !shift && !alt && key === 'w') { e.preventDefault(); closeTab(activeTabIdRef.current); return }
    if (ctrl && !shift && !alt && key === 'tab') {
      e.preventDefault()
      const idx = tabsRef.current.findIndex(t => t.id === activeTabIdRef.current)
      const next = tabsRef.current[(idx + 1) % tabsRef.current.length]
      if (next) switchTab(next.id)
      return
    }
    if (ctrl && shift && !alt && key === 'tab') {
      e.preventDefault()
      const idx = tabsRef.current.findIndex(t => t.id === activeTabIdRef.current)
      const prev = tabsRef.current[(idx - 1 + tabsRef.current.length) % tabsRef.current.length]
      if (prev) switchTab(prev.id)
      return
    }
  }, [openLinkDialog, openFind, openReplace, handleSave, handleSaveAs, openNewTab, closeTab, switchTab])

  const handleCaptureKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F8')  { e.preventDefault(); e.stopPropagation(); setFocusMode(v => !v) }
    if (e.key === 'F9')  { e.preventDefault(); e.stopPropagation(); setTypewriterMode(v => !v) }
    if (e.key === 'F11') {
      e.preventDefault(); e.stopPropagation()
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
      else document.exitFullscreen().catch(() => {})
    }
    if (e.key === 'Escape') {
      if (prefsVisible)             { e.preventDefault(); e.stopPropagation(); handlePrefsClose() }
      else if (findVisible)         { e.preventDefault(); e.stopPropagation(); closeFind() }
      else if (linkDialogVisible)   { e.preventDefault(); e.stopPropagation(); setLinkDialogVisible(false) }
      else if (quickOpenVisible)    { e.preventDefault(); e.stopPropagation(); setQuickOpenVisible(false) }
      else if (globalSearchVisible) { e.preventDefault(); e.stopPropagation(); setGlobalSearchVisible(false) }
    }
  }, [prefsVisible, findVisible, linkDialogVisible, quickOpenVisible, globalSearchVisible, closeFind, handlePrefsClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleCaptureKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleCaptureKeyDown, { capture: true })
    }
  }, [handleKeyDown, handleCaptureKeyDown])

  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    const name = activeTab?.filePath ? activeTab.filePath.split(/[\\/]/).pop() : 'Sem título'
    const dirty = activeTab?.isDirty ? '● ' : ''
    document.title = `${dirty}${name} — TypeShu`
  }, [tabs, activeTabId])

  const activeTab      = tabs.find(t => t.id === activeTabId)
  const activeFilePath = activeTab?.filePath ?? null
  const activeIsDirty  = activeTab?.isDirty ?? false

  const shellClass = [
    'app-shell',
    focusMode      ? 'focus-mode'      : '',
    typewriterMode ? 'typewriter-mode' : '',
    sourceMode     ? 'source-mode'     : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      <TitleBar onAction={handleTitleBarAction} />

      <div className="app-body">
        <ActivityBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          onQuickOpen={() => setQuickOpenVisible(true)}
          onPrefs={() => setPrefsVisible(true)}
        />

        {sidebarOpen && (
          globalSearchVisible ? (
            <div className="sidebar">
              <GlobalSearch
                dirPath={currentDirPath}
                onOpen={(path, content) => { openInTab(path, content); setGlobalSearchVisible(false) }}
                onClose={() => setGlobalSearchVisible(false)}
              />
            </div>
          ) : (
            <Sidebar
              currentFilePath={activeFilePath}
              currentMarkdown={outlineMarkdown}
              recentFiles={recentFiles}
              onFileOpen={openInTab}
              onDirChange={handleDirChange}
              onFileDelete={handleFileDelete}
              onFileRename={handleFileRename}
            />
          )
        )}

        <div className="editor-area">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={switchTab}
            onClose={closeTab}
            onReorder={reorderTabs}
          />

          {activeFilePath && (
            <Toolbar
              onBulletList={() => editorRef.current?.toggleBulletList()}
              onOrderedList={() => editorRef.current?.toggleOrderedList()}
              onInsertTable={() => editorRef.current?.insertTable()}
              onInsertFootnote={() => editorRef.current?.insertFootnote()}
              sourceMode={sourceMode}
              onToggleSource={() => setSourceMode(v => !v)}
            />
          )}

          {externalChanged && (
            <ExternalChangeBanner
              onReload={handleReloadExternal}
              onDismiss={() => setExternalChanged(false)}
            />
          )}
          {findVisible && (
            <FindBar
              showReplace={findReplace}
              onFind={handleFind} onNext={handleFindNext} onPrev={handleFindPrev}
              onReplaceOne={handleReplaceOne} onReplaceAll={handleReplaceAll}
              onClose={closeFind} matchCount={findMatches} currentMatch={findCurrent}
            />
          )}
          {sourceMode ? (
            <textarea
              className="source-editor"
              defaultValue={editorContentRef.current}
              onChange={(e) => {
                editorContentRef.current = e.target.value
                setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, content: e.target.value, isDirty: true } : t))
                setWordCountContent(e.target.value)
                setOutlineMarkdown(e.target.value)
                setAutoSaved(false)
              }}
              onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
              spellCheck={prefs.spellCheck} autoFocus
            />
          ) : (
            <div className="milkdown-root" ref={milkdownContainerRef}>
              {frontMatter !== null && <FrontMatterPanel content={frontMatter} />}
              <MilkdownAdapter
                key={editorKey}
                initialContent={initialContent}
                editorRef={editorRef}
                onKeyDown={handleKeyDown}
                onChange={handleChange}
                onFindState={handleFindState}
                currentFilePath={activeFilePath}
              />
            </div>
          )}
        </div>
      </div>

      <StatusBar
        content={wordCountContent}
        filePath={activeFilePath}
        isDirty={activeIsDirty}
        autoSaved={autoSaved}
      />

      {!sourceMode && (
        <FloatingToolbar
          editorContainerRef={milkdownContainerRef}
          onExecute={(from, to, fn) => editorRef.current?.executeWithSelection(from, to, fn)}
          onBold={() => editorRef.current?.toggleBold()}
          onItalic={() => editorRef.current?.toggleItalic()}
          onStrike={() => editorRef.current?.toggleStrikethrough()}
          onInlineCode={handleInlineCode}
          onLink={openLinkDialog}
          onBlockquote={() => editorRef.current?.toggleBlockquote()}
          onHeading={(lvl) => editorRef.current?.setHeading(lvl)}
        />
      )}

      {quickOpenVisible   && <QuickOpen dirPath={currentDirPath} onOpen={openInTab} onClose={() => setQuickOpenVisible(false)} />}
      {linkDialogVisible  && <LinkDialog initialLabel={linkInitialLabel} onConfirm={handleLinkConfirm} onClose={() => setLinkDialogVisible(false)} />}
      {prefsVisible       && <PrefsPanel prefs={prefs} onChange={handlePrefsChange} onClose={handlePrefsClose} />}
    </div>
  )
}
