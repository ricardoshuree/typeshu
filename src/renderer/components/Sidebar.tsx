// [mcp-local harness] feature: backlog-phase1 | plano: 97306772 | 2026-09-18
// +aba RECENT; +sort A→Z/Z→A/data na aba FILES; mtime em FileEntry
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FileEntry, DirListResult, RecentFile } from '@shared/types'

declare const window: Window & {
  api: {
    listDir:    (dirPath: string) => Promise<DirListResult>
    openDir:    () => Promise<DirListResult>
    openPath:   (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
    newFile:    (dirPath: string, fileName: string) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>
    renameFile: (oldPath: string, newName: string)  => Promise<{ success: boolean; oldPath?: string; newPath?: string; newName?: string; error?: string }>
    deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
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

// ── Context Menu ──────────────────────────────────────────────────────────
interface ContextMenuState { x: number; y: number; entry: FileEntry }

function ContextMenu({ menu, onRename, onDelete, onClose }: {
  menu: ContextMenuState
  onRename: (entry: FileEntry) => void
  onDelete: (entry: FileEntry) => void
  onClose:  () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])
  return (
    <div ref={ref} className="ctx-menu" style={{ top: menu.y, left: menu.x }}>
      <button className="ctx-menu-item" onClick={() => { onRename(menu.entry); onClose() }}>✏️ Renomear</button>
      <div className="ctx-menu-separator" />
      <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => { onDelete(menu.entry); onClose() }}>🗑️ Mover para lixeira</button>
    </div>
  )
}

// ── Rename Input ──────────────────────────────────────────────────────────
function RenameInput({ initialName, onConfirm, onCancel, depth }: {
  initialName: string; onConfirm: (n: string) => void; onCancel: () => void; depth: number
}): React.JSX.Element {
  const [value, setValue] = useState(initialName.replace(/\.(md|txt|markdown)$/, ''))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  return (
    <div className="tree-item tree-item--renaming" style={{ paddingLeft: `${12 + depth * 14}px` }}>
      <span className="tree-icon" />
      <input
        ref={inputRef} className="tree-rename-input" value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()); if (e.key === 'Escape') onCancel() }}
        onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel() }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── New File Input ────────────────────────────────────────────────────────
function NewFileInput({ onConfirm, onCancel }: { onConfirm: (n: string) => void; onCancel: () => void }): React.JSX.Element {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  return (
    <div className="tree-item tree-item--renaming" style={{ paddingLeft: '12px' }}>
      <span className="tree-icon">📄</span>
      <input
        ref={inputRef} className="tree-rename-input" value={value} placeholder="nome-do-arquivo"
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()); if (e.key === 'Escape') onCancel() }}
        onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel() }}
      />
    </div>
  )
}

// ── TreeNode ──────────────────────────────────────────────────────────────
function TreeNode({ entry, currentFilePath, onFileClick, onContextMenu, renamingPath, onRenameConfirm, onRenameCancel, depth, sortMode }: {
  entry: FileEntry; currentFilePath: string | null
  onFileClick: (e: FileEntry) => void; onContextMenu: (ev: React.MouseEvent, e: FileEntry) => void
  renamingPath: string | null; onRenameConfirm: (e: FileEntry, n: string) => void; onRenameCancel: () => void
  depth: number; sortMode: SortMode
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const isActive   = entry.path === currentFilePath
  const isRenaming = renamingPath === entry.path

  const sortEntries = (list: FileEntry[]): FileEntry[] => {
    const dirs  = list.filter(e => e.isDirectory)
    const files = list.filter(e => !e.isDirectory)
    const sort = (arr: FileEntry[]) => {
      if (sortMode === 'az')   return [...arr].sort((a, b) => a.name.localeCompare(b.name))
      if (sortMode === 'za')   return [...arr].sort((a, b) => b.name.localeCompare(a.name))
      if (sortMode === 'date') return [...arr].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
      return arr
    }
    return [...sort(dirs), ...sort(files)]
  }

  const handleClick = async () => {
    if (isRenaming) return
    if (entry.isDirectory) {
      if (!expanded && children.length === 0) {
        const result = await window.api.listDir(entry.path)
        if (result.success && result.entries) setChildren(result.entries)
      }
      setExpanded(v => !v)
    } else { onFileClick(entry) }
  }

  if (isRenaming) {
    return (
      <div className="tree-node">
        <RenameInput initialName={entry.name} depth={depth} onConfirm={n => onRenameConfirm(entry, n)} onCancel={onRenameCancel} />
      </div>
    )
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isActive ? 'tree-item--active' : ''} ${entry.isDirectory ? 'tree-item--dir' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={handleClick}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, entry) }}
        title={entry.path}
      >
        <span className="tree-icon">{entry.isDirectory ? (expanded ? '▾' : '▸') : ''}</span>
        <span className="tree-name">{entry.name}</span>
      </div>
      {entry.isDirectory && expanded && (
        <div className="tree-children">
          {sortEntries(children).map(child => (
            <TreeNode
              key={child.path} entry={child} currentFilePath={currentFilePath}
              onFileClick={onFileClick} onContextMenu={onContextMenu}
              renamingPath={renamingPath} onRenameConfirm={onRenameConfirm} onRenameCancel={onRenameCancel}
              depth={depth + 1} sortMode={sortMode}
            />
          ))}
          {children.length === 0 && <div className="tree-empty" style={{ paddingLeft: `${12 + (depth + 1) * 14}px` }}>vazio</div>}
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

// ── Sort button label ─────────────────────────────────────────────────────
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [creatingNew, setCreatingNew]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null)

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

  const handleNewFileConfirm = useCallback(async (name: string) => {
    if (!dirPath) return
    setCreatingNew(false)
    const result = await window.api.newFile(dirPath, name)
    if (result.success && result.path !== undefined) {
      await refreshDir(dirPath)
      onFileOpen(result.path, result.content ?? '')
    }
  }, [dirPath, refreshDir, onFileOpen])

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

  const headerLabel = tab === 'files' ? dirName : tab === 'recent' ? 'Recentes' : (currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'Outline')

  return (
    <aside className="sidebar">
      {/* Tabs */}
      <div className="sidebar-tabs">
        <button className={`sidebar-tab${tab === 'files'   ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('files')}>FILES</button>
        <button className={`sidebar-tab${tab === 'outline' ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('outline')}>OUTLINE</button>
        <button className={`sidebar-tab${tab === 'recent'  ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('recent')}>RECENT</button>
        {tab === 'files' && <button className="sidebar-btn" onClick={handleOpenDir} title="Abrir pasta" style={{ marginLeft: 'auto' }}>⊞</button>}
      </div>

      {/* Header */}
      <div className="sidebar-header">
        <span className="sidebar-title" title={dirPath ?? ''}>{headerLabel}</span>
        {tab === 'files' && dirPath && (
          <>
            <button
              className="sidebar-btn sidebar-sort-btn"
              title={SORT_TITLES[SORT_NEXT[sortMode]]}
              onClick={() => setSortMode(SORT_NEXT[sortMode])}
            >
              {SORT_LABELS[sortMode]}
            </button>
            <button className="sidebar-btn" title="Novo arquivo" onClick={() => { setCreatingNew(true); setRenamingPath(null) }}>＋</button>
          </>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmDelete name={confirmDelete.name} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmDelete(null)} />
      )}

      {/* Conteúdo */}
      {tab === 'recent' ? (
        <RecentPanel files={recentFiles} currentFilePath={currentFilePath} onFileOpen={onFileOpen} />
      ) : tab === 'outline' ? (
        <div className="sidebar-tree"><OutlinePanel markdown={currentMarkdown} /></div>
      ) : (
        <div className="sidebar-tree">
          {entries.length === 0 && !creatingNew ? (
            <div className="sidebar-empty">
              <p>Nenhuma pasta aberta</p>
              <button className="sidebar-open-btn" onClick={handleOpenDir}>Abrir pasta</button>
            </div>
          ) : (
            <>
              {creatingNew && <NewFileInput onConfirm={handleNewFileConfirm} onCancel={() => setCreatingNew(false)} />}
              {sortEntries(entries).map(entry => (
                <TreeNode
                  key={entry.path} entry={entry} currentFilePath={currentFilePath}
                  onFileClick={handleFileClick}
                  onContextMenu={(e, entry) => setContextMenu({ x: e.clientX, y: e.clientY, entry })}
                  renamingPath={renamingPath} onRenameConfirm={handleRenameConfirm} onRenameCancel={() => setRenamingPath(null)}
                  depth={0} sortMode={sortMode}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onRename={entry => setRenamingPath(entry.path)}
          onDelete={entry => setConfirmDelete(entry)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  )
}
