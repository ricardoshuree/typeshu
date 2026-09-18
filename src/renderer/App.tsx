// [mcp-local harness] feature: backlog-phase1 | plano: 97306772 | 2026-09-18
// +blockquote/lists/table atalhos e IPC; +addRecent ao abrir arquivo; +recentFiles para sidebar
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MilkdownAdapter, EditorHandle } from './editor/MilkdownAdapter'
import { setFindOpener, setReplaceOpener } from './editor/shortcutPlugin'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { FrontMatterPanel, extractFrontMatter } from './components/FrontMatterPanel'
import { QuickOpen } from './components/QuickOpen'
import { GlobalSearch } from './components/GlobalSearch'
import { LinkDialog } from './components/LinkDialog'
import { FindBar } from './components/FindBar'
import { PrefsPanel } from './components/PrefsPanel'
import { IPC, NOTIFY, DEFAULT_PREFERENCES, type UserPreferences, type RecentFile } from '@shared/types'

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
  const [initialContent, setInitialContent]           = useState(WELCOME_MD)
  const [editorKey, setEditorKey]                     = useState(0)
  const [filePath, setFilePath]                       = useState<string | null>(null)
  const [isDirty, setIsDirty]                         = useState(false)
  const [fileName, setFileName]                       = useState('Sem título')
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

  const editorContentRef    = useRef(WELCOME_MD)
  const filePathRef         = useRef<string | null>(null)
  const isDirtyRef          = useRef(false)
  const autoSaveIntervalRef = useRef(AUTO_SAVE_INTERVAL_DEFAULT)
  const editorRef           = useRef<EditorHandle>(null)

  useEffect(() => { filePathRef.current = filePath }, [filePath])
  useEffect(() => { isDirtyRef.current = isDirty },   [isDirty])

  // ── Carrega prefs e recentes ───────────────────────────────────────────
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

  // ── Find / Replace ────────────────────────────────────────────────────
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

  const handleFindState   = useCallback((matches: number, current: number) => {
    setFindMatches(matches); setFindCurrent(current)
    setTimeout(() => editorRef.current?.scrollToCurrentMatch(), 0)
  }, [])

  const handleFind       = useCallback((q: string, cs: boolean) => editorRef.current?.find(q, cs), [])
  const handleFindNext   = useCallback(() => editorRef.current?.findNext(), [])
  const handleFindPrev   = useCallback(() => editorRef.current?.findPrev(), [])
  const handleReplaceOne = useCallback((r: string) => editorRef.current?.replaceOne(r), [])
  const handleReplaceAll = useCallback((r: string) => editorRef.current?.replaceAll(r), [])

  // ── File ops ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (path: string, content: string) => {
    const fm = extractFrontMatter(content); const editorMd = fm ? fm.body : content
    editorContentRef.current = content
    setInitialContent(editorMd); setEditorKey(k => k + 1)
    setFilePath(path); setFileName(path.split(/[\\/]/).pop() ?? path)
    setIsDirty(false); setSourceMode(false)
    setWordCountContent(content); setFrontMatter(fm ? fm.content : null); setOutlineMarkdown(editorMd)
    setCurrentDirPath(path.replace(/[\\/][^\\/]+$/, ''))
    setExternalChanged(false); setAutoSaved(false)
    window.api.watchStart(path)
    // Registra nos recentes e reconstrói o menu
    const updated = await window.api.addRecent(path)
    setRecentFiles(updated)
  }, [])

  const handleChange = useCallback((md: string) => {
    const fm = extractFrontMatter(editorContentRef.current)
    const full = fm ? `---\n${fm.content}\n---\n${md}` : md
    editorContentRef.current = full
    setIsDirty(true); setWordCountContent(full); setOutlineMarkdown(md); setAutoSaved(false)
  }, [])

  const handleDirChange  = useCallback((dir: string) => setCurrentDirPath(dir), [])

  const handleFileDelete = useCallback((deletedPath: string) => {
    if (deletedPath === filePathRef.current) {
      window.api.watchStop(); editorContentRef.current = ''
      setInitialContent(''); setEditorKey(k => k + 1)
      setFilePath(null); setFileName('Sem título')
      setIsDirty(false); setFrontMatter(null); setOutlineMarkdown('')
      setWordCountContent(''); setAutoSaved(false); setExternalChanged(false)
    }
  }, [])

  const handleFileRename = useCallback((oldPath: string, newPath: string) => {
    if (oldPath === filePathRef.current) {
      setFilePath(newPath); setFileName(newPath.split(/[\\/]/).pop() ?? newPath)
      window.api.watchStart(newPath)
    }
  }, [])

  // ── Auto-save ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!isDirtyRef.current || !filePathRef.current) return
      const r = await window.api.saveFile(filePathRef.current, editorContentRef.current)
      if (r.success) { setIsDirty(false); setAutoSaved(true); setTimeout(() => setAutoSaved(false), 3000) }
    }, autoSaveIntervalRef.current)
    return () => clearInterval(timer)
  }, [prefs.autoSave, prefs.autoSaveInterval])

  useEffect(() => {
    window.api.on(NOTIFY.FILE_CHANGED_EXTERNALLY, () => setExternalChanged(true))
    return () => window.api.removeAllListeners(NOTIFY.FILE_CHANGED_EXTERNALLY)
  }, [])

  const handleReloadExternal = useCallback(async () => {
    if (!filePathRef.current) return
    const r = await window.api.openPath(filePathRef.current)
    if (r.success && r.content !== undefined && r.path) loadFile(r.path, r.content)
    setExternalChanged(false)
  }, [loadFile])

  useEffect(() => {
    window.api.on('file:opened', (...args: unknown[]) => {
      const r = args[0] as { success: boolean; path?: string; content?: string }
      if (r.success && r.content !== undefined && r.path) loadFile(r.path, r.content)
    })
    return () => window.api.removeAllListeners('file:opened')
  }, [loadFile])

  // ── Listener: arquivo aberto via Open Recent no menu ─────────────────
  useEffect(() => {
    window.api.on('recent:open', async (...args: unknown[]) => {
      const path = args[0] as string
      const updated = await window.api.addRecent(path)
      setRecentFiles(updated)
    })
    return () => window.api.removeAllListeners('recent:open')
  }, [])

  // ── Listener: recent atualizado pelo main (ex: limpar) ────────────────
  useEffect(() => {
    window.api.on(NOTIFY.RECENT_CHANGED, (...args: unknown[]) => {
      setRecentFiles(args[0] as RecentFile[])
    })
    return () => window.api.removeAllListeners(NOTIFY.RECENT_CHANGED)
  }, [])

  // ── Link Dialog ───────────────────────────────────────────────────────
  const openLinkDialog = useCallback(() => {
    const selected = editorRef.current?.getSelectedText() ?? ''
    setLinkInitialLabel(selected); setLinkDialogVisible(true)
  }, [])

  const handleLinkConfirm = useCallback((label: string, url: string) => {
    editorRef.current?.replaceSelectionWith(`[${label}](${url})`); setLinkDialogVisible(false)
  }, [])

  // ── IPC listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    window.api.on('ui:open-quickly',  () => setQuickOpenVisible(true))
    window.api.on('ui:global-search', () => { setGlobalSearchVisible(true); setSidebarOpen(true) })
    window.api.on('ui:export-html',   () => exportHTML(fileName || 'documento'))
    window.api.on('ui:export-pdf',    () => window.print())
    window.api.on('ui:preferences',   () => setPrefsVisible(true))
    window.api.on('format:bold',           () => editorRef.current?.toggleBold())
    window.api.on('format:italic',         () => editorRef.current?.toggleItalic())
    window.api.on('format:strikethrough',  () => editorRef.current?.toggleStrikethrough())
    window.api.on('format:blockquote',     () => editorRef.current?.toggleBlockquote())
    window.api.on('format:bullet-list',    () => editorRef.current?.toggleBulletList())
    window.api.on('format:ordered-list',   () => editorRef.current?.toggleOrderedList())
    window.api.on('format:table',          () => editorRef.current?.insertTable())
    window.api.on('format:link',           () => openLinkDialog())
    window.api.on('format:code-fence',     () => editorRef.current?.insertCodeFence())
    window.api.on('format:heading', (...args: unknown[]) => editorRef.current?.setHeading((args[0] as number) as 0|1|2|3|4|5|6))
    window.api.on('view:toggle-sidebar',    () => setSidebarOpen(v => !v))
    window.api.on('view:toggle-source',     () => setSourceMode(v => !v))
    window.api.on('view:toggle-focus',      () => setFocusMode(v => !v))
    window.api.on('view:toggle-typewriter', () => setTypewriterMode(v => !v))
    return () => {
      ;['ui:open-quickly','ui:global-search','ui:export-html','ui:export-pdf','ui:preferences',
        'format:bold','format:italic','format:strikethrough','format:blockquote',
        'format:bullet-list','format:ordered-list','format:table',
        'format:link','format:code-fence','format:heading',
        'view:toggle-sidebar','view:toggle-source','view:toggle-focus','view:toggle-typewriter',
      ].forEach(ch => window.api.removeAllListeners(ch))
    }
  }, [fileName, openLinkDialog])

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSaveAs = useCallback(async () => {
    const r = await window.api.saveFileAs(editorContentRef.current)
    if (r.success && r.path) {
      setFilePath(r.path); setFileName(r.path.split(/[\\/]/).pop() ?? r.path); setIsDirty(false)
      window.api.watchStart(r.path)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!filePath) return handleSaveAs()
    const r = await window.api.saveFile(filePath, editorContentRef.current)
    if (r.success) { setIsDirty(false); setAutoSaved(true); setTimeout(() => setAutoSaved(false), 2000) }
  }, [filePath, handleSaveAs])

  const handleNew = useCallback(() => {
    window.api.watchStop(); editorContentRef.current = ''
    setInitialContent(''); setEditorKey(k => k + 1); setFilePath(null); setFileName('Sem título')
    setIsDirty(false); setSourceMode(false); setWordCountContent('')
    setFrontMatter(null); setOutlineMarkdown(''); setExternalChanged(false); setAutoSaved(false)
  }, [])

  useEffect(() => {
    window.api.on(IPC.FILE_SAVE,    () => handleSave())
    window.api.on(IPC.FILE_SAVE_AS, () => handleSaveAs())
    window.api.on(IPC.FILE_NEW,     () => handleNew())
    return () => { [IPC.FILE_SAVE, IPC.FILE_SAVE_AS, IPC.FILE_NEW].forEach(ch => window.api.removeAllListeners(ch)) }
  }, [handleSave, handleSaveAs, handleNew])

  // ── Keyboard ──────────────────────────────────────────────────────────
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
  }, [openLinkDialog, openFind, openReplace])

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

  useEffect(() => { document.title = `${isDirty ? '● ' : ''}${fileName} — TypeShu` }, [fileName, isDirty])

  const shellClass = [
    'app-shell',
    focusMode      ? 'focus-mode'      : '',
    typewriterMode ? 'typewriter-mode' : '',
    sourceMode     ? 'source-mode'     : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      <Toolbar
        fileName={fileName}
        isDirty={isDirty}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
        onPrefs={() => setPrefsVisible(true)}
      />

      <div className="app-body">
        {sidebarOpen && (
          globalSearchVisible ? (
            <div className="sidebar">
              <GlobalSearch
                dirPath={currentDirPath}
                onOpen={(path, content) => { loadFile(path, content); setGlobalSearchVisible(false) }}
                onClose={() => setGlobalSearchVisible(false)}
              />
            </div>
          ) : (
            <Sidebar
              currentFilePath={filePath}
              currentMarkdown={outlineMarkdown}
              recentFiles={recentFiles}
              onFileOpen={loadFile}
              onDirChange={handleDirChange}
              onFileDelete={handleFileDelete}
              onFileRename={handleFileRename}
            />
          )
        )}

        <div className="editor-area">
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
                setIsDirty(true); setWordCountContent(e.target.value)
                setOutlineMarkdown(e.target.value); setAutoSaved(false)
              }}
              onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
              spellCheck={prefs.spellCheck} autoFocus
            />
          ) : (
            <div className="milkdown-root">
              {frontMatter !== null && <FrontMatterPanel content={frontMatter} />}
              <MilkdownAdapter
                key={editorKey} initialContent={initialContent}
                editorRef={editorRef} onKeyDown={handleKeyDown}
                onChange={handleChange} onFindState={handleFindState}
              />
            </div>
          )}
          <StatusBar content={wordCountContent} filePath={filePath} isDirty={isDirty} autoSaved={autoSaved} />
        </div>
      </div>

      {quickOpenVisible   && <QuickOpen dirPath={currentDirPath} onOpen={loadFile} onClose={() => setQuickOpenVisible(false)} />}
      {linkDialogVisible  && <LinkDialog initialLabel={linkInitialLabel} onConfirm={handleLinkConfirm} onClose={() => setLinkDialogVisible(false)} />}
      {prefsVisible       && <PrefsPanel prefs={prefs} onChange={handlePrefsChange} onClose={handlePrefsClose} />}
    </div>
  )
}
