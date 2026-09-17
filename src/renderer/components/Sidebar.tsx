// [mcp-local harness] feature: outline-panel | plano: af178e3c | 2026-09-17 14:43:46
// Sidebar com abas FILES/OUTLINE — OutlinePanel extrai headings do Markdown e rola o editor ao clicar
// Sidebar com abas FILES e OUTLINE
import React, { useState, useEffect, useCallback } from 'react'
import type { FileEntry, DirListResult } from '@shared/types'

declare const window: Window & {
  api: {
    listDir: (dirPath: string) => Promise<DirListResult>
    openDir: () => Promise<DirListResult>
    openPath: (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
  }
}

// ── Tipos ────────────────────────────────────────────────────────────────
interface SidebarProps {
  currentFilePath: string | null
  currentMarkdown:  string          // conteúdo Markdown atual para o Outline
  onFileOpen: (path: string, content: string) => void
}

interface TreeNodeProps {
  entry: FileEntry
  currentFilePath: string | null
  onFileClick: (entry: FileEntry) => void
  depth: number
}

interface HeadingItem {
  level: number    // 1-6
  text:  string
  index: number    // posição na lista (para key único)
}

// ── Extrai headings do Markdown ──────────────────────────────────────────
function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split('\n')
  const items: HeadingItem[] = []
  let index = 0
  let inFence = false

  for (const line of lines) {
    // Ignora conteúdo dentro de code fences
    if (line.trim().startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      items.push({
        level: match[1].length,
        text:  match[2].trim(),
        index: index++,
      })
    }
  }
  return items
}

// ── Rola o editor até o heading clicado ─────────────────────────────────
function scrollToHeading(text: string): void {
  // Procura no DOM do ProseMirror por h1-h6 com texto correspondente
  const editor = document.querySelector('.ProseMirror')
  if (!editor) return

  const headings = editor.querySelectorAll('h1,h2,h3,h4,h5,h6')
  for (const h of headings) {
    if (h.textContent?.trim() === text) {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Pequeno offset para não colar no topo
      setTimeout(() => window.scrollBy(0, -60), 350)
      return
    }
  }
}

// ── TreeNode (File Tree) ─────────────────────────────────────────────────
function TreeNode({ entry, currentFilePath, onFileClick, depth }: TreeNodeProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const isActive = entry.path === currentFilePath

  const handleClick = async () => {
    if (entry.isDirectory) {
      if (!expanded && children.length === 0) {
        const result = await window.api.listDir(entry.path)
        if (result.success && result.entries) setChildren(result.entries)
      }
      setExpanded((v) => !v)
    } else {
      onFileClick(entry)
    }
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isActive ? 'tree-item--active' : ''} ${entry.isDirectory ? 'tree-item--dir' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={handleClick}
        title={entry.path}
      >
        <span className="tree-icon">
          {entry.isDirectory ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="tree-name">{entry.name}</span>
      </div>
      {entry.isDirectory && expanded && (
        <div className="tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              currentFilePath={currentFilePath}
              onFileClick={onFileClick}
              depth={depth + 1}
            />
          ))}
          {children.length === 0 && (
            <div className="tree-empty" style={{ paddingLeft: `${12 + (depth + 1) * 14}px` }}>
              vazio
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── OutlinePanel ─────────────────────────────────────────────────────────
function OutlinePanel({ markdown }: { markdown: string }): React.JSX.Element {
  const headings = extractHeadings(markdown)

  if (headings.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>Nenhum heading encontrado.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Use # H1, ## H2, etc. para criar a estrutura do documento.
        </p>
      </div>
    )
  }

  // Nível mínimo presente no documento (para ajustar indentação relativa)
  const minLevel = Math.min(...headings.map((h) => h.level))

  return (
    <div className="outline-list">
      {headings.map((h) => (
        <div
          key={h.index}
          className={`outline-item outline-item--h${h.level}`}
          style={{ paddingLeft: `${8 + (h.level - minLevel) * 14}px` }}
          onClick={() => scrollToHeading(h.text)}
          title={h.text}
        >
          <span className="outline-bullet">
            {h.level === 1 ? '■' : h.level === 2 ? '▪' : '·'}
          </span>
          <span className="outline-text">{h.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Sidebar principal ────────────────────────────────────────────────────
type Tab = 'files' | 'outline'

export function Sidebar({ currentFilePath, currentMarkdown, onFileOpen }: SidebarProps): React.JSX.Element {
  const [tab, setTab]           = useState<Tab>('files')
  const [entries, setEntries]   = useState<FileEntry[]>([])
  const [dirPath, setDirPath]   = useState<string | null>(null)
  const [dirName, setDirName]   = useState<string>('Nenhuma pasta')

  // Abre a pasta que contém o arquivo atual automaticamente
  useEffect(() => {
    if (!currentFilePath) return
    const dir = currentFilePath.replace(/[\\/][^\\/]+$/, '')
    if (dir === dirPath) return
    window.api.listDir(dir).then((result) => {
      if (result.success && result.entries) {
        setEntries(result.entries)
        setDirPath(dir)
        setDirName(dir.split(/[\\/]/).pop() ?? dir)
      }
    })
  }, [currentFilePath, dirPath])

  const handleOpenDir = useCallback(async () => {
    const result = await window.api.openDir()
    if (result.success && result.entries && result.dirPath) {
      setEntries(result.entries)
      setDirPath(result.dirPath)
      setDirName(result.dirPath.split(/[\\/]/).pop() ?? result.dirPath)
    }
  }, [])

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    const result = await window.api.openPath(entry.path)
    if (result.success && result.content !== undefined && result.path) {
      onFileOpen(result.path, result.content)
    }
  }, [onFileOpen])

  const headerLabel = tab === 'files'
    ? dirName
    : (currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'Outline')

  return (
    <aside className="sidebar">
      {/* ── Abas ── */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${tab === 'files' ? ' sidebar-tab--active' : ''}`}
          onClick={() => setTab('files')}
        >
          FILES
        </button>
        <button
          className={`sidebar-tab${tab === 'outline' ? ' sidebar-tab--active' : ''}`}
          onClick={() => setTab('outline')}
        >
          OUTLINE
        </button>
        {tab === 'files' && (
          <button className="sidebar-btn" onClick={handleOpenDir} title="Abrir pasta" style={{ marginLeft: 'auto' }}>
            ⊞
          </button>
        )}
      </div>

      {/* ── Label da pasta / arquivo ── */}
      <div className="sidebar-header" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <span className="sidebar-title" title={dirPath ?? ''}>{headerLabel}</span>
      </div>

      {/* ── Conteúdo da aba ── */}
      <div className="sidebar-tree">
        {tab === 'files' ? (
          entries.length === 0 ? (
            <div className="sidebar-empty">
              <p>Nenhuma pasta aberta</p>
              <button className="sidebar-open-btn" onClick={handleOpenDir}>Abrir pasta</button>
            </div>
          ) : (
            entries.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                currentFilePath={currentFilePath}
                onFileClick={handleFileClick}
                depth={0}
              />
            ))
          )
        ) : (
          <OutlinePanel markdown={currentMarkdown} />
        )}
      </div>
    </aside>
  )
}
