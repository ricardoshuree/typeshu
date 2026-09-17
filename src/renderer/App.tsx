// [mcp-local harness] feature: sidebar-filetree | plano: de4bef30 | 2026-09-17 13:41:25
// App.tsx com Sidebar integrada e toggle Ctrl+backslash
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MilkdownAdapter, EditorHandle } from './editor/MilkdownAdapter'
import { Sidebar } from './components/Sidebar'
import { IPC } from '@shared/types'

const WELCOME_MD = `# Bem-vindo ao TypeShuDown

Este é um editor Markdown com **live preview** — o que você digita é renderizado instantaneamente.

## Começando

- Abra um arquivo com \`Ctrl+O\`
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

export default function App(): React.JSX.Element {
  const [initialContent, setInitialContent] = useState(WELCOME_MD)
  const [editorKey, setEditorKey]           = useState(0)
  const [filePath, setFilePath]             = useState<string | null>(null)
  const [isDirty, setIsDirty]               = useState(false)
  const [fileName, setFileName]             = useState('Sem título')
  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const [focusMode, setFocusMode]           = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [sourceMode, setSourceMode]         = useState(false)

  const editorContentRef = useRef(WELCOME_MD)
  const editorRef        = useRef<EditorHandle>(null)

  // ── Abrir arquivo (menu) ─────────────────────────────────────────────
  useEffect(() => {
    window.api.on('file:opened', (...args: unknown[]) => {
      const result = args[0] as { success: boolean; path?: string; content?: string }
      if (result.success && result.content !== undefined && result.path) {
        loadFile(result.path, result.content)
      }
    })
    return () => window.api.removeAllListeners('file:opened')
  }, [])

  const loadFile = useCallback((path: string, content: string) => {
    editorContentRef.current = content
    setInitialContent(content)
    setEditorKey((k) => k + 1)
    setFilePath(path)
    setFileName(path.split(/[\\/]/).pop() ?? path)
    setIsDirty(false)
    setSourceMode(false)
  }, [])

  // ── Save / SaveAs / New ──────────────────────────────────────────────
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
    setInitialContent('')
    setEditorKey((k) => k + 1)
    setFilePath(null)
    setFileName('Sem título')
    setIsDirty(false)
    setSourceMode(false)
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

  // ── Atalhos de teclado ───────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 'b')  { e.preventDefault(); editorRef.current?.toggleBold(); return }
    if (ctrl && e.key === 'i')  { e.preventDefault(); editorRef.current?.toggleItalic(); return }
    if (ctrl && e.key >= '1' && e.key <= '6') {
      e.preventDefault(); editorRef.current?.setHeading(Number(e.key) as 1|2|3|4|5|6); return
    }
    if (ctrl && e.key === '0') { e.preventDefault(); editorRef.current?.setHeading(0); return }
    if (ctrl && e.key === '/') { e.preventDefault(); setSourceMode((v) => !v); return }
    if (ctrl && e.key === '\\') { e.preventDefault(); setSidebarOpen((v) => !v); return }
  }, [])

  const handleCaptureKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'F8') { e.preventDefault(); e.stopPropagation(); setFocusMode((v) => !v) }
    if (e.key === 'F9') { e.preventDefault(); e.stopPropagation(); setTypewriterMode((v) => !v) }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleCaptureKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleCaptureKeyDown, { capture: true })
    }
  }, [handleKeyDown, handleCaptureKeyDown])

  // ── Título da janela ─────────────────────────────────────────────────
  useEffect(() => {
    document.title = `${isDirty ? '● ' : ''}${fileName} — TypeShuDown`
  }, [fileName, isDirty])

  const shellClass = [
    'app-shell',
    sidebarOpen    ? 'sidebar-open'    : '',
    focusMode      ? 'focus-mode'      : '',
    typewriterMode ? 'typewriter-mode' : '',
    sourceMode     ? 'source-mode'     : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      {sidebarOpen && (
        <Sidebar
          currentFilePath={filePath}
          onFileOpen={loadFile}
        />
      )}
      <div className="editor-area">
        {sourceMode ? (
          <textarea
            className="source-editor"
            defaultValue={editorContentRef.current}
            onChange={(e) => { editorContentRef.current = e.target.value; setIsDirty(true) }}
            onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
            spellCheck={false}
            autoFocus
          />
        ) : (
          <div className="milkdown-root">
            <MilkdownAdapter
              key={editorKey}
              initialContent={initialContent}
              editorRef={editorRef}
              onKeyDown={handleKeyDown}
              onChange={(md) => { editorContentRef.current = md; setIsDirty(true) }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
