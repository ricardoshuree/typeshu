// [mcp-local harness] feature: fix-menu-channels | plano: 7f4727c6 | 2026-09-17 15:49:22
// App.tsx com listeners para Format/View menu + Export HTML/PDF via window.print e blob download
// App.tsx — completo: sidebar, format/view menu, export, global search, open quickly
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MilkdownAdapter, EditorHandle } from './editor/MilkdownAdapter'
import { Sidebar } from './components/Sidebar'
import { FrontMatterPanel, extractFrontMatter } from './components/FrontMatterPanel'
import { QuickOpen } from './components/QuickOpen'
import { GlobalSearch } from './components/GlobalSearch'
import { IPC } from '@shared/types'

const WELCOME_MD = `# Bem-vindo ao TypeShuDown

Este é um editor Markdown com **live preview** — o que você digita é renderizado instantaneamente.

## Começando

- Abra um arquivo com \`Ctrl+O\`
- Busca rápida com \`Ctrl+P\`
- Busca em arquivos com \`Ctrl+Shift+F\`
- Toggle sidebar com \`Ctrl+\\\`
- Salve com \`Ctrl+S\`
- Alterne modo código com \`Ctrl+/\`
- Focus Mode com \`F8\` · Typewriter com \`F9\`

## Markdown suportado

| Elemento | Sintaxe |
| --- | --- |
| **Negrito** | \`Ctrl+B\` |
| *Itálico* | \`Ctrl+I\` |
| Heading 1 | \`Ctrl+1\` |

> Comece a digitar aqui ou abra um arquivo existente.
`

declare const window: Window & {
  api: {
    openFile:           () => Promise<{ success: boolean; path?: string; content?: string }>
    saveFile:           (path: string, content: string) => Promise<{ success: boolean }>
    saveFileAs:         (content: string) => Promise<{ success: boolean; path?: string }>
    on:                 (channel: string, cb: (...args: unknown[]) => void) => void
    removeAllListeners: (channel: string) => void
  }
}

function countWords(text: string): number { return text.trim() === '' ? 0 : text.trim().split(/\s+/).length }
function countChars(text: string): number { return text.replace(/\r\n/g, '\n').length }
function readingTime(words: number): string { const m = Math.ceil(words / 200); return m <= 1 ? '< 1 min' : `${m} min` }

interface StatusBarProps { content: string; filePath: string | null; isDirty: boolean }
function StatusBar({ content, filePath, isDirty }: StatusBarProps): React.JSX.Element {
  const words = countWords(content); const chars = countChars(content); const time = readingTime(words)
  const name = filePath ? filePath.split(/[\\/]/).pop() : 'Sem título'
  return (
    <div className="status-bar">
      <span className="status-file">{isDirty ? '● ' : ''}{name}</span>
      <span className="status-counts">{words.toLocaleString()} palavras · {chars.toLocaleString()} chars · {time}</span>
    </div>
  )
}

// ── Exportação HTML ───────────────────────────────────────────────────────
function exportHTML(fileName: string): void {
  const editor = document.querySelector('.ProseMirror')
  if (!editor) return
  // Coleta CSS relevante da página
  const styles = Array.from(document.styleSheets)
    .map(ss => { try { return Array.from(ss.cssRules).map(r => r.cssText).join('\n') } catch { return '' } })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    body { max-width: 800px; margin: 40px auto; font-family: Georgia, serif; font-size: 16px; line-height: 1.6; color: #1a1a1a; padding: 0 24px; }
    h1,h2,h3,h4,h5,h6 { font-family: -apple-system, sans-serif; font-weight: 600; margin: 1.2em 0 0.4em; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
    code { font-family: monospace; background: #f3f3f3; padding: 0.1em 0.4em; border-radius: 3px; }
    pre { background: #f3f3f3; padding: 1em; overflow-x: auto; border-radius: 4px; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #e0e0e0; padding-left: 1em; color: #6b6b6b; margin: 0.75em 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e0e0e0; padding: 0.5em 0.75em; text-align: left; }
    th { background: #f3f3f3; font-weight: 600; }
    a { color: #4a90d9; }
    img { max-width: 100%; }
  </style>
</head>
<body>
${editor.innerHTML}
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = fileName.replace(/\.(md|markdown|txt)$/i, '') + '.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── App ──────────────────────────────────────────────────────────────────
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

  const editorContentRef = useRef(WELCOME_MD)
  const editorRef        = useRef<EditorHandle>(null)

  const loadFile = useCallback((path: string, content: string) => {
    const fm = extractFrontMatter(content)
    const editorMd = fm ? fm.body : content
    editorContentRef.current = content
    setInitialContent(editorMd); setEditorKey((k) => k + 1)
    setFilePath(path); setFileName(path.split(/[\\/]/).pop() ?? path)
    setIsDirty(false); setSourceMode(false)
    setWordCountContent(content); setFrontMatter(fm ? fm.content : null); setOutlineMarkdown(editorMd)
    setCurrentDirPath(path.replace(/[\\/][^\\/]+$/, ''))
  }, [])

  const handleChange = useCallback((md: string) => {
    const fm = extractFrontMatter(editorContentRef.current)
    const full = fm ? `---\n${fm.content}\n---\n${md}` : md
    editorContentRef.current = full
    setIsDirty(true); setWordCountContent(full); setOutlineMarkdown(md)
  }, [])

  const handleDirChange = useCallback((dir: string) => setCurrentDirPath(dir), [])

  // ── IPC listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    window.api.on('file:opened', (...args: unknown[]) => {
      const r = args[0] as { success: boolean; path?: string; content?: string }
      if (r.success && r.content !== undefined && r.path) loadFile(r.path, r.content)
    })
    return () => window.api.removeAllListeners('file:opened')
  }, [])

  useEffect(() => {
    window.api.on('ui:open-quickly',  () => setQuickOpenVisible(true))
    window.api.on('ui:global-search', () => { setGlobalSearchVisible(true); setSidebarOpen(true) })
    // Export HTML via blob download
    window.api.on('ui:export-html',   () => exportHTML(fileName || 'documento'))
    // Export PDF via window.print() (Electron intercepta e mostra diálogo nativo)
    window.api.on('ui:export-pdf',    () => window.print())
    // Format menu
    window.api.on('format:bold',    () => editorRef.current?.toggleBold())
    window.api.on('format:italic',  () => editorRef.current?.toggleItalic())
    window.api.on('format:heading', (...args: unknown[]) => editorRef.current?.setHeading((args[0] as number) as 0|1|2|3|4|5|6))
    // View menu
    window.api.on('view:toggle-sidebar',    () => setSidebarOpen(v => !v))
    window.api.on('view:toggle-source',     () => setSourceMode(v => !v))
    window.api.on('view:toggle-focus',      () => setFocusMode(v => !v))
    window.api.on('view:toggle-typewriter', () => setTypewriterMode(v => !v))
    return () => {
      ;['ui:open-quickly','ui:global-search','ui:export-html','ui:export-pdf',
        'format:bold','format:italic','format:heading',
        'view:toggle-sidebar','view:toggle-source','view:toggle-focus','view:toggle-typewriter'
      ].forEach(ch => window.api.removeAllListeners(ch))
    }
  }, [fileName])

  const handleSaveAs = useCallback(async () => {
    const r = await window.api.saveFileAs(editorContentRef.current)
    if (r.success && r.path) { setFilePath(r.path); setFileName(r.path.split(/[\\/]/).pop() ?? r.path); setIsDirty(false) }
  }, [])

  const handleSave = useCallback(async () => {
    if (!filePath) return handleSaveAs()
    const r = await window.api.saveFile(filePath, editorContentRef.current)
    if (r.success) setIsDirty(false)
  }, [filePath, handleSaveAs])

  const handleNew = useCallback(() => {
    editorContentRef.current = ''
    setInitialContent(''); setEditorKey((k) => k + 1); setFilePath(null); setFileName('Sem título')
    setIsDirty(false); setSourceMode(false); setWordCountContent(''); setFrontMatter(null); setOutlineMarkdown('')
  }, [])

  useEffect(() => {
    window.api.on(IPC.FILE_SAVE,    () => handleSave())
    window.api.on(IPC.FILE_SAVE_AS, () => handleSaveAs())
    window.api.on(IPC.FILE_NEW,     () => handleNew())
    return () => { [IPC.FILE_SAVE, IPC.FILE_SAVE_AS, IPC.FILE_NEW].forEach(ch => window.api.removeAllListeners(ch)) }
  }, [handleSave, handleSaveAs, handleNew])

  // ── Atalhos de teclado ───────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return
    if (e.key === 'b') { e.preventDefault(); editorRef.current?.toggleBold(); return }
    if (e.key === 'i') { e.preventDefault(); editorRef.current?.toggleItalic(); return }
    if (e.key >= '1' && e.key <= '6' && !e.shiftKey && !e.altKey) { e.preventDefault(); editorRef.current?.setHeading(Number(e.key) as 1|2|3|4|5|6); return }
    if (e.key === '0' && e.shiftKey) { e.preventDefault(); editorRef.current?.setHeading(0); return }
    if (e.key === '/')  { e.preventDefault(); setSourceMode(v => !v); return }
    if (e.key === '\\') { e.preventDefault(); setSidebarOpen(v => !v); return }
  }, [])

  const handleCaptureKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F8')  { e.preventDefault(); e.stopPropagation(); setFocusMode(v => !v) }
    if (e.key === 'F9')  { e.preventDefault(); e.stopPropagation(); setTypewriterMode(v => !v) }
    if (e.key === 'F11') {
      e.preventDefault(); e.stopPropagation()
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
      else document.exitFullscreen().catch(() => {})
    }
    if (e.key === 'Escape') {
      if (quickOpenVisible)         { e.preventDefault(); e.stopPropagation(); setQuickOpenVisible(false) }
      else if (globalSearchVisible) { e.preventDefault(); e.stopPropagation(); setGlobalSearchVisible(false) }
    }
  }, [quickOpenVisible, globalSearchVisible])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleCaptureKeyDown, { capture: true })
    return () => { window.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keydown', handleCaptureKeyDown, { capture: true }) }
  }, [handleKeyDown, handleCaptureKeyDown])

  useEffect(() => { document.title = `${isDirty ? '● ' : ''}${fileName} — TypeShuDown` }, [fileName, isDirty])

  const shellClass = ['app-shell', sidebarOpen ? 'sidebar-open' : '', focusMode ? 'focus-mode' : '', typewriterMode ? 'typewriter-mode' : '', sourceMode ? 'source-mode' : ''].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
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
          <Sidebar currentFilePath={filePath} currentMarkdown={outlineMarkdown} onFileOpen={loadFile} onDirChange={handleDirChange} />
        )
      )}
      <div className="editor-area">
        {sourceMode ? (
          <textarea
            className="source-editor"
            defaultValue={editorContentRef.current}
            onChange={(e) => { editorContentRef.current = e.target.value; setIsDirty(true); setWordCountContent(e.target.value); setOutlineMarkdown(e.target.value) }}
            onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
            spellCheck={false} autoFocus
          />
        ) : (
          <div className="milkdown-root">
            {frontMatter !== null && <FrontMatterPanel content={frontMatter} />}
            <MilkdownAdapter key={editorKey} initialContent={initialContent} editorRef={editorRef} onKeyDown={handleKeyDown} onChange={handleChange} />
          </div>
        )}
        <StatusBar content={wordCountContent} filePath={filePath} isDirty={isDirty} />
      </div>
      {quickOpenVisible && <QuickOpen dirPath={currentDirPath} onOpen={loadFile} onClose={() => setQuickOpenVisible(false)} />}
    </div>
  )
}
