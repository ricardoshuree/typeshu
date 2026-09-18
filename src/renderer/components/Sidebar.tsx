// [mcp-local harness] feature: sidebar-tree-icons | plano: 11bccff7 | 2026-09-18
// Adiciona ícones SVG inline (pasta/arquivo) no TreeNode
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FileEntry, DirListResult, RecentFile } from '@shared/types'

declare const window: Window & {
  api: {
    listDir:          (dirPath: string) => Promise<DirListResult>
    openDir:          () => Promise<DirListResult>
    openPath:         (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
    newFile:          (dirPath: string, fileName: string) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>
    newDir:           (parentPath: string, dirName: string) => Promise<{ success: boolean; path?: string; error?: string }>
    renameFile:       (oldPath: string, newName: string)  => Promise<{ success: boolean; oldPath?: string; newPath?: string; newName?: string; error?: string }>
    deleteFile:       (filePath: string) => Promise<{ success: boolean; error?: string }>
    revealInExplorer: (filePath: string) => Promise<{ success: boolean; error?: string }>
    copyPath:         (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
}

type SortMode = 'az' | 'za' | 'date'

interface SidebarProps {
  currentFilePath: string | null
  currentMarkdown:  string
  recentFiles:      RecentFile[]
  onFileOpen:   (path: string, content: string) => void
  onDirChange:  (dirPath: string) => void
  onFileDelete?: (path: string) => void
  onFileRename?: (oldPath: string, newPath: string) => void
}

// ── SVG Icons ─────────────────────────────────────────────────────────────
function IconFolder({ open }: { open: boolean }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 5.5A1.5 1.5 0 0 1 3 4h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 7v5A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V5.5z" fill="#e8c97a" opacity="0.85"/>
      <path d="M1.5 7h13" stroke="#e8c97a" strokeWidth="1" opacity="0.5"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M1.5 5A1.5 1.5 0 0 1 3 3.5h3L7.5 5H13A1.5 1.5 0 0 1 14.5 6.5V12A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V5z" stroke="#e8c97a" strokeWidth="1.25" fill="none"/>
    </svg>
  )
}

function IconFile({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const color = ext === 'md' || ext === 'markdown' ? '#569cd6' : '#858585'
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={color} strokeWidth="1.25"/>
      <path d="M10 2v4h4" stroke={color} strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Context Menu ──────────────────────────────────────────────────────────
interface ContextMenuState { x: number; y: number; entry: FileEntry }

function ContextMenu({ menu, onRename, onDelete, onReveal, onCopyPath, onClose }: {
  menu: ContextMenuState
  onRename:   (entry: FileEntry) => void
  onDelete:   (entry: FileEntry) => void
  onReveal:   (entry: FileEntry) => void
  onCopyPath: (entry: FileEntry) => void
  onClose:    () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div ref={ref} className="ctx-menu" style={{ top: menu.y, left: menu.x }}>
      <button className="ctx-menu-item" onClick={() => { onRename(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>✏️</span>Renomear
      </button>
      <button className="ctx-menu-item" onClick={() => { onCopyPath(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>📋</span>Copiar caminho
      </button>
      <button className="ctx-menu-item" onClick={() => { onReveal(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>📂</span>Revelar no Explorer
      </button>
      <div className="ctx-menu-separator" />
      <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => { onDelete(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>🗑️</span>Mover para lixeira
      </button>
    </div>
  )
}

// ── Inline Input ──────────────────────────────────────────────────────────
function InlineInput({ initialValue, placeholder, selectUpToLastDot, paddingLeft, onConfirm, onCancel }: {
  initialValue: string
  placeholder?: string
  selectUpToLastDot?: boolean
  paddingLeft: number
  onConfirm: (value: string) => void
  onCancel:  () => void
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current; if (!el) return
    el.focus()
    if (selectUpToLastDot) {
      const dot = initialValue.lastIndexOf('.')
      el.setSelectionRange(0, dot > 0 ? dot : initialValue.length)
    } else {
      el.select()
    }
  }, [initialValue, selectUpToLastDot])

  return (
    <div className="tree-item tree-item--renaming" style={{ paddingLeft }}>
      <span className="tree-icon" />
      <input
        ref={inputRef}
        className="tree-rename-input"
        value={value}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) { e.stopPropagation(); onConfirm(value.trim()) }
          if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
        }}
        onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel() }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── TreeNode ──────────────────────────────────────────────────────────────
type CreatingInDir = { parentPath: string; type: 'file' | 'dir' }

function TreeNode({ entry, currentFilePath, onFileClick, onContextMenu, renamingPath, onRenameConfirm, onRenameCancel, depth, sortMode, creatingInDir, onNewFileConfirm, onNewDirConfirm, onNewCancel }: {
  entry: FileEntry
  currentFilePath: string | null
  onFileClick:     (e: FileEntry) => void
  onContextMenu:   (ev: React.MouseEvent, e: FileEntry) => void
  renamingPath:    string | null
  onRenameConfirm: (e: FileEntry, n: string) => void
  onRenameCancel:  () => void
  depth:           number
  sortMode:        SortMode
  creatingInDir:   CreatingInDir | null
  onNewFileConfirm: (parentPath: string, name: string) => void
  onNewDirConfirm:  (parentPath: string, name: string) => void
  onNewCancel:      () => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const isActive   = entry.path === currentFilePath
  const isRenaming = renamingPath === entry.path

  const sortList = useCallback((list: FileEntry[]): FileEntry[] => {
    const dirs  = list.filter(e => e.isDirectory)
    const files = list.filter(e => !e.isDirectory)
    const sort = (arr: FileEntry[]) => {
      if (sortMode === 'az')   return [...arr].sort((a, b) => a.name.localeCompare(b.name))
      if (sortMode === 'za')   return [...arr].sort((a, b) => b.name.localeCompare(a.name))
      if (sortMode === 'date') return [...arr].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
      return arr
    }
    return [...sort(dirs), ...sort(files)]
  }, [sortMode])

  useEffect(() => {
    if (creatingInDir?.parentPath === entry.path && !expanded) setExpanded(true)
  }, [creatingInDir, entry.path, expanded])

  const loadChildren = useCallback(async () => {
    const result = await window.api.listDir(entry.path)
    if (result.success && result.entries) setChildren(result.entries)
  }, [entry.path])

  const handleClick = async () => {
    if (isRenaming) return
    if (entry.isDirectory) {
      if (!expanded) await loadChildren()
      setExpanded(v => !v)
    } else { onFileClick(entry) }
  }

  if (isRenaming) {
    return (
      <div className="tree-node">
        <InlineInput
          initialValue={entry.name}
          selectUpToLastDot={!entry.isDirectory}
          paddingLeft={12 + depth * 14}
          onConfirm={n => onRenameConfirm(entry, n)}
          onCancel={onRenameCancel}
        />
      </div>
    )
  }

  const showCreatingInside = creatingInDir?.parentPath === entry.path && expanded

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isActive ? 'tree-item--active' : ''} ${entry.isDirectory ? 'tree-item--dir' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px`, gap: 4 }}
        onClick={handleClick}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, entry) }}
        title={entry.path}
      >
        {/* chevron para dirs, espaço fixo para arquivos */}
        <span style={{ width: 10, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'center' }}>
          {entry.isDirectory ? (expanded ? '▾' : '▸') : ''}
        </span>
        {/* ícone de tipo */}
        {entry.isDirectory
          ? <IconFolder open={expanded} />
          : <IconFile name={entry.name} />
        }
        <span className="tree-name">{entry.name}</span>
      </div>

      {entry.isDirectory && expanded && (
        <div className="tree-children">
          {showCreatingInside && creatingInDir?.type === 'file' && (
            <InlineInput
              initialValue="sem-título.md"
              selectUpToLastDot
              paddingLeft={12 + (depth + 1) * 14}
              onConfirm={n => onNewFileConfirm(entry.path, n)}
              onCancel={onNewCancel}
            />
          )}
          {showCreatingInside && creatingInDir?.type === 'dir' && (
            <InlineInput
              initialValue="nova-pasta"
              paddingLeft={12 + (depth + 1) * 14}
              onConfirm={n => onNewDirConfirm(entry.path, n)}
              onCancel={onNewCancel}
            />
          )}
          {sortList(children).map(child => (
            <TreeNode
              key={child.path} entry={child} currentFilePath={currentFilePath}
              onFileClick={onFileClick} onContextMenu={onContextMenu}
              renamingPath={renamingPath} onRenameConfirm={onRenameConfirm} onRenameCancel={onRenameCancel}
              depth={depth + 1} sortMode={sortMode}
              creatingInDir={creatingInDir}
              onNewFileConfirm={onNewFileConfirm} onNewDirConfirm={onNewDirConfirm} onNewCancel={onNewCancel}
            />
          ))}
          {children.length === 0 && !showCreatingInside && (
            <div className="tree-empty" style={{ paddingLeft: `${12 + (depth + 1) * 14}px` }}>vazio</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Outline ───────────────────────────────────────────────────────────────
interface HeadingItem { level: number; text: string; index: number }

function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split('\n'); const items: HeadingItem[] = []
  let index = 0; let inFence = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) items.push({ level: match[1].length, text: match[2].trim(), index: index++ })
  }
  return items
}

function scrollToHeading(text: string): void {
  const editor = document.querySelector('.ProseMirror'); if (!editor) return
  const headings = editor.querySelectorAll('h1,h2,h3,h4,h5,h6')
  for (const h of headings) {
    if (h.textContent?.trim() === text) { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
  }
}

function OutlinePanel({ markdown }: { markdown: string }): React.JSX.Element {
  const headings = extractHeadings(markdown)
  if (headings.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>Nenhum heading encontrado.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>Use # H1, ## H2, etc.</p>
      </div>
    )
  }
  const minLevel = Math.min(...headings.map(h => h.level))
  return (
    <div className="outline-list">
      {headings.map(h => (
        <div
          key={h.index}
          className={`outline-item outline-item--h${h.level}`}
          style={{ paddingLeft: `${8 + (h.level - minLevel) * 14}px` }}
          onClick={() => scrollToHeading(h.text)}
          title={h.text}
        >
          <span className="outline-bullet">{h.level === 1 ? '■' : h.level === 2 ? '▪' : '·'}</span>
          <span className="outline-text">{h.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Recent Panel ──────────────────────────────────────────────────────────
function RecentPanel({ files, currentFilePath, onFileOpen }: {
  files: RecentFile[]; currentFilePath: string | null
  onFileOpen: (path: string, content: string) => void
}): React.JSX.Element {
  const handleClick = useCallback(async (r: RecentFile) => {
    const result = await window.api.openPath(r.path)
    if (result.success && result.content !== undefined && result.path) {
      onFileOpen(result.path, result.content)
    }
  }, [onFileOpen])

  if (files.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>Nenhum arquivo recente.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>Abra um arquivo para vê-lo aqui.</p>
      </div>
    )
  }

  return (
    <div className="sidebar-tree">
      {files.map(r => (
        <div
          key={r.path}
          className={`tree-item ${r.path === currentFilePath ? 'tree-item--active' : ''}`}
          style={{ paddingLeft: '12px' }}
          onClick={() => handleClick(r)}
          title={r.path}
        >
          <span className="tree-icon" />
          <span className="tree-name">{r.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── Confirm Delete ────────────────────────────────────────────────────────
function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }): React.JSX.Element {
  return (
    <div className="confirm-delete">
      <p className="confirm-delete-msg">Mover <strong>{name}</strong> para a lixeira?</p>
      <div className="confirm-delete-actions">
        <button className="confirm-delete-btn" onClick={onCancel}>Cancelar</button>
        <button className="confirm-delete-btn confirm-delete-btn--danger" onClick={onConfirm}>Mover para lixeira</button>
      </div>
    </div>
  )
}

// ── Sort ──────────────────────────────────────────────────────────────────
const SORT_LABELS: Record<SortMode, string> = { az: 'A→Z', za: 'Z→A', date: '🕐' }
const SORT_TITLES: Record<SortMode, string> = { az: 'Ordenar A→Z', za: 'Ordenar Z→A', date: 'Ordenar por data' }
const SORT_NEXT:  Record<SortMode, SortMode> = { az: 'za', za: 'date', date: 'az' }

// ── Sidebar ───────────────────────────────────────────────────────────────
type Tab = 'files' | 'outline' | 'recent'

export function Sidebar({ currentFilePath, currentMarkdown, recentFiles, onFileOpen, onDirChange, onFileDelete, onFileRename }: SidebarProps): React.JSX.Element {
  const [tab, setTab]               = useState<Tab>('files')
  const [entries, setEntries]       = useState<FileEntry[]>([])
  const [dirPath, setDirPath]       = useState<string | null>(null)
  const [dirName, setDirName]       = useState<string>('Nenhuma pasta')
  const [sortMode, setSortMode]     = useState<SortMode>('az')
  const [contextMenu, setContextMenu]     = useState<ContextMenuState | null>(null)
  const [renamingPath, setRenamingPath]   = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null)
  const [creatingRoot, setCreatingRoot]   = useState<'file' | 'dir' | null>(null)
  const [creatingInDir, setCreatingInDir] = useState<CreatingInDir | null>(null)

  const sortEntries = useCallback((list: FileEntry[]): FileEntry[] => {
    const dirs  = list.filter(e => e.isDirectory)
    const files = list.filter(e => !e.isDirectory)
    const sort = (arr: FileEntry[]) => {
      if (sortMode === 'az')   return [...arr].sort((a, b) => a.name.localeCompare(b.name))
      if (sortMode === 'za')   return [...arr].sort((a, b) => b.name.localeCompare(a.name))
      if (sortMode === 'date') return [...arr].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
      return arr
    }
    return [...sort(dirs), ...sort(files)]
  }, [sortMode])

  const applyDir = useCallback((path: string, ents: FileEntry[]) => {
    setEntries(ents); setDirPath(path)
    setDirName(path.split(/[\\/]/).pop() ?? path)
    onDirChange(path)
  }, [onDirChange])

  const refreshDir = useCallback(async (path: string) => {
    const result = await window.api.listDir(path)
    if (result.success && result.entries) applyDir(path, result.entries)
  }, [applyDir])

  useEffect(() => {
    if (!currentFilePath) return
    const dir = currentFilePath.replace(/[\\/][^\\/]+$/, '')
    if (dir === dirPath) return
    window.api.listDir(dir).then(result => {
      if (result.success && result.entries) applyDir(dir, result.entries)
    })
  }, [currentFilePath, dirPath, applyDir])

  const handleOpenDir = useCallback(async () => {
    const result = await window.api.openDir()
    if (result.success && result.entries && result.dirPath) applyDir(result.dirPath, result.entries)
  }, [applyDir])

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    const result = await window.api.openPath(entry.path)
    if (result.success && result.content !== undefined && result.path) onFileOpen(result.path, result.content)
  }, [onFileOpen])

  const handleNewFileRoot = useCallback(async (name: string) => {
    if (!dirPath) return
    setCreatingRoot(null)
    const result = await window.api.newFile(dirPath, name)
    if (result.success && result.path !== undefined) {
      await refreshDir(dirPath)
      onFileOpen(result.path, result.content ?? '')
    }
  }, [dirPath, refreshDir, onFileOpen])

  const handleNewDirRoot = useCallback(async (name: string) => {
    if (!dirPath) return
    setCreatingRoot(null)
    const result = await window.api.newDir(dirPath, name)
    if (result.success) await refreshDir(dirPath)
  }, [dirPath, refreshDir])

  const handleNewFileInDir = useCallback(async (parentPath: string, name: string) => {
    setCreatingInDir(null)
    const result = await window.api.newFile(parentPath, name)
    if (result.success && result.path) {
      if (dirPath) await refreshDir(dirPath)
      onFileOpen(result.path, result.content ?? '')
    }
  }, [dirPath, refreshDir, onFileOpen])

  const handleNewDirInDir = useCallback(async (parentPath: string, name: string) => {
    setCreatingInDir(null)
    const result = await window.api.newDir(parentPath, name)
    if (result.success && dirPath) await refreshDir(dirPath)
  }, [dirPath, refreshDir])

  const handleRenameConfirm = useCallback(async (entry: FileEntry, newName: string) => {
    setRenamingPath(null)
    const result = await window.api.renameFile(entry.path, newName)
    if (result.success && result.newPath) {
      if (dirPath) await refreshDir(dirPath)
      if (entry.path === currentFilePath && result.newPath) onFileRename?.(entry.path, result.newPath)
    }
  }, [dirPath, currentFilePath, refreshDir, onFileRename])

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return
    const entry = confirmDelete; setConfirmDelete(null)
    const result = await window.api.deleteFile(entry.path)
    if (result.success) {
      if (dirPath) await refreshDir(dirPath)
      if (entry.path === currentFilePath) onFileDelete?.(entry.path)
    }
  }, [confirmDelete, dirPath, currentFilePath, refreshDir, onFileDelete])

  const handleReveal   = useCallback((entry: FileEntry) => { window.api.revealInExplorer(entry.path) }, [])
  const handleCopyPath = useCallback((entry: FileEntry) => { window.api.copyPath(entry.path) }, [])

  const headerLabel = tab === 'files' ? dirName : tab === 'recent' ? 'Recentes' : (currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'Outline')

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={`sidebar-tab${tab === 'files'   ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('files')}>FILES</button>
        <button className={`sidebar-tab${tab === 'outline' ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('outline')}>OUTLINE</button>
        <button className={`sidebar-tab${tab === 'recent'  ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('recent')}>RECENT</button>
        {tab === 'files' && <button className="sidebar-btn" onClick={handleOpenDir} title="Abrir pasta" style={{ marginLeft: 'auto' }}>⊞</button>}
      </div>

      <div className="sidebar-header">
        <span className="sidebar-title" title={dirPath ?? ''}>{headerLabel}</span>
        {tab === 'files' && dirPath && (
          <>
            <button className="sidebar-btn sidebar-sort-btn" title={SORT_TITLES[SORT_NEXT[sortMode]]} onClick={() => setSortMode(SORT_NEXT[sortMode])}>
              {SORT_LABELS[sortMode]}
            </button>
            <button className="sidebar-btn" title="Novo arquivo" onClick={() => { setCreatingRoot('file'); setCreatingInDir(null); setRenamingPath(null) }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="Novo arquivo">
                <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                <line x1="6" y1="9.5" x2="10" y2="9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                <line x1="8" y1="7.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="sidebar-btn" title="Nova pasta" onClick={() => { setCreatingRoot('dir'); setCreatingInDir(null); setRenamingPath(null) }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="Nova pasta">
                <path d="M1.5 5A1.5 1.5 0 0 1 3 3.5h3L7.5 5H13A1.5 1.5 0 0 1 14.5 6.5V12A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V5z" stroke="currentColor" strokeWidth="1.25"/>
                <line x1="8" y1="7.5" x2="8" y2="10.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                <line x1="6.5" y1="9" x2="9.5" y2="9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDelete name={confirmDelete.name} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmDelete(null)} />
      )}

      {tab === 'recent' ? (
        <RecentPanel files={recentFiles} currentFilePath={currentFilePath} onFileOpen={onFileOpen} />
      ) : tab === 'outline' ? (
        <div className="sidebar-tree"><OutlinePanel markdown={currentMarkdown} /></div>
      ) : (
        <div className="sidebar-tree">
          {entries.length === 0 && !creatingRoot ? (
            <div className="sidebar-empty">
              <p>Nenhuma pasta aberta</p>
              <button className="sidebar-open-btn" onClick={handleOpenDir}>Abrir pasta</button>
            </div>
          ) : (
            <>
              {creatingRoot === 'file' && (
                <InlineInput initialValue="sem-título.md" selectUpToLastDot paddingLeft={12} onConfirm={handleNewFileRoot} onCancel={() => setCreatingRoot(null)} />
              )}
              {creatingRoot === 'dir' && (
                <InlineInput initialValue="nova-pasta" paddingLeft={12} onConfirm={handleNewDirRoot} onCancel={() => setCreatingRoot(null)} />
              )}
              {sortEntries(entries).map(entry => (
                <TreeNode
                  key={entry.path} entry={entry} currentFilePath={currentFilePath}
                  onFileClick={handleFileClick}
                  onContextMenu={(e, entry) => { setContextMenu({ x: e.clientX, y: e.clientY, entry }); setConfirmDelete(null) }}
                  renamingPath={renamingPath} onRenameConfirm={handleRenameConfirm} onRenameCancel={() => setRenamingPath(null)}
                  depth={0} sortMode={sortMode}
                  creatingInDir={creatingInDir}
                  onNewFileConfirm={handleNewFileInDir} onNewDirConfirm={handleNewDirInDir} onNewCancel={() => setCreatingInDir(null)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onRename={entry => { setRenamingPath(entry.path); setContextMenu(null) }}
          onDelete={entry => { setConfirmDelete(entry); setContextMenu(null) }}
          onReveal={handleReveal}
          onCopyPath={handleCopyPath}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  )
}
