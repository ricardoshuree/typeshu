// [mcp-local harness] feature: fix-ctrl0-conflict | plano: 6590933d | 2026-09-17 15:26:07
// Remove Ctrl+0 do handler de heading — conflito com zoom do Electron
// App.tsx — sidebar, word count, fullscreen, front matter, outline, open quickly
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MilkdownAdapter, EditorHandle } from './editor/MilkdownAdapter'
import { Sidebar } from './components/Sidebar'
import { FrontMatterPanel, extractFrontMatter } from './components/FrontMatterPanel'
import { QuickOpen } from './components/QuickOpen'
import { IPC } from '@shared/types'

const WELCOME_MD = `# Bem-vindo ao TypeShuDown

Este é um editor Markdown com **live preview** — o que você digita é renderizado instantaneamente.

## Começando

- Abra um arquivo com \`Ctrl+O\`
- Busca rápida com \`Ctrl+P\`
- Toggle sidebar com \`Ctrl+\\\`
- Salve com \`Ctrl+S\`
- Alterne modo código com \`Ctrl+/\`

## Markdown suportado

| Elemento | Sintaxe |
| --- | --- |
| **Negrito** | \`**texto**\` |
| *Itálico* | \`*texto*\` |
| \`Código\` | \`\\\`código\\\`\` |

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

export default function App(): React.JSX.Element {
  const [initialContent, setInitialContent]     = useState(WELCOME_MD)
  const [editorKey, setEditorKey]               = useState(0)
  const [filePath, setFilePath]                 = useState<string | null>(null)
  const [isDirty, setIsDirty]                   = useState(false)
  const [fileName, setFileName]                 = useState('Sem título')
  const [sidebarOpen, setSidebarOpen]           = useState(false)
  const [focusMode, setFocusMode]               = useState(false)
  const [typewriterMode, setTypewriterMode]     = useState(false)
  const [sourceMode, setSourceMode]             = useState(false)
  const [wordCountContent, setWordCountContent] = useState(WELCOME_MD)
  const [frontMatter, setFrontMatter]           = useState<string | null>(null)
  const [outlineMarkdown, setOutlineMarkdown]   = useState(WELCOME_MD)
  const [quickOpenVisible, setQuickOpenVisible] = useState(false)
  const [currentDirPath, setCurrentDirPath]     = useState<string | null>(null)

  const editorContentRef = useRef(WELCOME_MD)
  const editorRef        = useRef<EditorHandle>(null)

  const loadFile = useCallback((path: string, content: string) => {
    const fm = extractFrontMatter(content)
    const editorMd = fm ? fm.body : content
    editorContentRef.current = content
    setInitialContent(editorMd)
    setEditorKey((k) => k + 1)
    setFilePath(path)
    setFileName(path.split(/[\\/]/).pop() ?? path)
    setIsDirty(false)
    setSourceMode(false)
    setWordCountContent(content)
    setFrontMatter(fm ? fm.content : null)
    setOutlineMarkdown(editorMd)
    const dir = path.replace(/[\\/][^\\/]+$/, '')
    setCurrentDirPath(dir)
  }, [])

  const handleChange = useCallback((md: string) => {
    const fm = extractFrontMatter(editorContentRef.current)
    const full = fm ? `---\n${fm.content}\n---\n${md}` : md
    editorContentRef.current = full
    setIsDirty(true)
    setWordCountContent(full)
    setOutlineMarkdown(md)
  }, [])

  const handleDirChange = useCallback((dir: string) => {
    setCurrentDirPath(dir)
  }, [])

  useEffect(() => {
    window.api.on('file:opened', (...args: unknown[]) => {
      const result = args[0] as { success: boolean; path?: string; content?: string }
      if (result.success && result.content !== undefined && result.path) {
        loadFile(result.path, result.content)
      }
    })
    return () => window.api.removeAllListeners('file:opened')
  }, [])

  useEffect(() => {
    window.api.on('ui:open-quickly', () => setQuickOpenVisible(true))
    return () => window.api.removeAllListeners('ui:open-quickly')
  }, [])

  const handleSaveAs = useCallback(async () => {
    const result = await window.api.saveFileAs(editorContentRef.current)
    if (result.success && result.path) {
      setFilePath(result.path)
      setFileName(result.path.split(/[\\/]/).pop() ?? result.path)
      setIsDirty(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!filePath) return handleSaveAs()
    const result = await window.api.saveFile(filePath, editorContentRef.current)
    if (result.success) setIsDirty(false)
  }, [filePath, handleSaveAs])

  const handleNew = useCallback(() => {
    editorContentRef.current = ''
    setInitialContent(''); setEditorKey((k) => k + 1)
    setFilePath(null); setFileName('Sem título')
    setIsDirty(false); setSourceMode(false)
    setWordCountContent(''); setFrontMatter(null); setOutlineMarkdown('')
  }, [])

  useEffect(() => {
    window.api.on(IPC.FILE_SAVE,    () => handleSave())
    window.api.on(IPC.FILE_SAVE_AS, () => handleSaveAs())
    window.api.on(IPC.FILE_NEW,     () => handleNew())
    return () => {
      window.api.removeAllListeners(IPC.FILE_SAVE)
      window.api.removeAllListeners(IPC.FILE_SAVE_AS)
      window.api.removeAllListeners(IPC.FILE_NEW)
    }
  }, [handleSave, handleSaveAs, handleNew])

  // ── Atalhos ───────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) return

    // Formatação
    if (e.key === 'b') { e.preventDefault(); editorRef.current?.toggleBold(); return }
    if (e.key === 'i') { e.preventDefault(); editorRef.current?.toggleItalic(); return }

    // Headings H1-H6: Ctrl+1 a Ctrl+6
    if (e.key >= '1' && e.key <= '6' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      editorRef.current?.setHeading(Number(e.key) as 1|2|3|4|5|6)
      return
    }

    // Parágrafo normal: Ctrl+Shift+0 (evita conflito com Ctrl+0 = Reset Zoom do Electron)
    if (e.key === '0' && e.shiftKey) {
      e.preventDefault()
      editorRef.current?.setHeading(0)
      return
    }

    // Modos de view
    if (e.key === '/')  { e.preventDefault(); setSourceMode((v) => !v); return }
    if (e.key === '\\') { e.preventDefault(); setSidebarOpen((v) => !v); return }
  }, [])

  const handleCaptureKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F8')  { e.preventDefault(); e.stopPropagation(); setFocusMode((v) => !v) }
    if (e.key === 'F9')  { e.preventDefault(); e.stopPropagation(); setTypewriterMode((v) => !v) }
    if (e.key === 'F11') {
      e.preventDefault(); e.stopPropagation()
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
      else document.exitFullscreen().catch(() => {})
    }
    if (e.key === 'Escape' && quickOpenVisible) {
      e.preventDefault(); e.stopPropagation(); setQuickOpenVisible(false)
    }
  }, [quickOpenVisible])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleCaptureKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleCaptureKeyDown, { capture: true })
    }
  }, [handleKeyDown, handleCaptureKeyDown])

  useEffect(() => {
    document.title = `${isDirty ? '● ' : ''}${fileName} — TypeShuDown`
  }, [fileName, isDirty])

  const shellClass = ['app-shell', sidebarOpen ? 'sidebar-open' : '', focusMode ? 'focus-mode' : '', typewriterMode ? 'typewriter-mode' : '', sourceMode ? 'source-mode' : ''].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      {sidebarOpen && (
        <Sidebar
          currentFilePath={filePath}
          currentMarkdown={outlineMarkdown}
          onFileOpen={loadFile}
          onDirChange={handleDirChange}
        />
      )}
      <div className="editor-area">
        {sourceMode ? (
          <textarea
            className="source-editor"
            defaultValue={editorContentRef.current}
            onChange={(e) => { editorContentRef.current = e.target.value; setIsDirty(true); setWordCountContent(e.target.value); setOutlineMarkdown(e.target.value) }}
            onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
            spellCheck={false}
            autoFocus
          />
        ) : (
          <div className="milkdown-root">
            {frontMatter !== null && <FrontMatterPanel content={frontMatter} />}
            <MilkdownAdapter
              key={editorKey}
              initialContent={initialContent}
              editorRef={editorRef}
              onKeyDown={handleKeyDown}
              onChange={handleChange}
            />
          </div>
        )}
        <StatusBar content={wordCountContent} filePath={filePath} isDirty={isDirty} />
      </div>

      {quickOpenVisible && (
        <QuickOpen
          dirPath={currentDirPath}
          onOpen={loadFile}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}
    </div>
  )
}
