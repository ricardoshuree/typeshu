// [mcp-local harness] feature: sidebar-flat-mode | plano: b12aa9c0 | 2026-09-18
// +viewMode: 'tree' | 'flat' — botões toggle no header, FlatPanel lista .md recursivamente
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { FileEntry, DirListResult, RecentFile } from '@shared/types'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

export const SIDEBAR_DRAG_KEY = 'typeshu/filepath'

declare const window: Window & {
  api: {
    listDir:          (dirPath: string) => Promise<DirListResult>
    openDir:          () => Promise<DirListResult>
    openPath:         (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
    newFile:          (dirPath: string, fileName: string) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>
    newDir:           (parentPath: string, dirName: string) => Promise<{ success: boolean; path?: string; error?: string }>
    renameFile:       (oldPath: string, newName: string)  => Promise<{ success: boolean; oldPath?: string; newPath?: string; newName?: string; error?: string }>
    moveFile:         (sourcePath: string, destDir: string) => Promise<{ success: boolean; sourcePath?: string; newPath?: string; error?: string }>
    deleteFile:       (filePath: string) => Promise<{ success: boolean; error?: string }>
    revealInExplorer: (filePath: string) => Promise<{ success: boolean; error?: string }>
    copyPath:         (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
}

type SortMode  = 'az' | 'za' | 'date'
type ViewMode  = 'tree' | 'flat'

interface SidebarProps {
  currentFilePath: string | null
  currentMarkdown:  string
  recentFiles:      RecentFile[]
  onFileOpen:   (path: string, content: string) => void
  onDirChange:  (dirPath: string) => void
  onFileDelete?: (path: string) => void
  onFileRename?: (oldPath: string, newPath: string) => void
  locale: Locale
}

interface DragState {
  entry:      FileEntry | null
  targetPath: string | null
}

interface FlatFile {
  path:     string
  name:     string
  relDir:   string
}

const HOVER_EXPAND_DELAY = 600
const MD_EXTS = new Set(['.md', '.markdown', '.txt'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'release', '.cache'])

async function collectFiles(dirPath: string, rootPath: string, depth = 0): Promise<FlatFile[]> {
  if (depth > 6) return []
  try {
    const result = await window.api.listDir(dirPath)
    if (!result.success || !result.entries) return []
    const files: FlatFile[] = []
    for (const entry of result.entries) {
      if (entry.isDirectory) {
        if (SKIP_DIRS.has(entry.name)) continue
        const sub = await collectFiles(entry.path, rootPath, depth + 1)
        files.push(...sub)
      } else {
        const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()
        if (!MD_EXTS.has(ext)) continue
        const rel = dirPath === rootPath
          ? ''
          : dirPath.replace(/\\/g, '/').slice(rootPath.replace(/\\/g, '/').length + 1)
        files.push({ path: entry.path, name: entry.name, relDir: rel })
      }
    }
    return files
  } catch { return [] }
}

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

function IconTreeView() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="3" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <line x1="3" y1="5"  x2="6"  y2="5"  stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <line x1="3" y1="9"  x2="6"  y2="9"  stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <line x1="3" y1="13" x2="6"  y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <rect x="6"  y="3"  width="7" height="3" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="8"  y="7"  width="6" height="3" rx="1" fill="currentColor" opacity="0.5"/>
      <rect x="8"  y="11" width="6" height="3" rx="1" fill="currentColor" opacity="0.5"/>
    </svg>
  )
}

function IconFlatList() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="2" y1="4"  x2="14" y2="4"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="2" y1="8"  x2="14" y2="8"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

interface ContextMenuState { x: number; y: number; entry: FileEntry }

function ContextMenu({ menu, locale, onRename, onDelete, onReveal, onCopyPath, onClose }: {
  menu: ContextMenuState
  locale: Locale
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
        <span style={{ fontSize: 13, marginRight: 6 }}>✏️</span>{t('ctx.rename', locale)}
      </button>
      <button className="ctx-menu-item" onClick={() => { onCopyPath(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>📋</span>{t('ctx.copyPath', locale)}
      </button>
      <button className="ctx-menu-item" onClick={() => { onReveal(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>📂</span>{t('ctx.reveal', locale)}
      </button>
      <div className="ctx-menu-separator" />
      <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => { onDelete(menu.entry); onClose() }}>
        <span style={{ fontSize: 13, marginRight: 6 }}>🗑️</span>{t('ctx.trash', locale)}
      </button>
    </div>
  )
}

function InlineInput({ initialValue, placeholder, selectUpToLastDot, paddingLeft, onConfirm, onCancel }: {
  initialValue: string; placeholder?: string; selectUpToLastDot?: boolean
  paddingLeft: number; onConfirm: (value: string) => void; onCancel: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = inputRef.current; if (!el) return
    el.focus()
    if (selectUpToLastDot) { const dot = initialValue.lastIndexOf('.'); el.setSelectionRange(0, dot > 0 ? dot : initialValue.length) }
    else el.select()
  }, [initialValue, selectUpToLastDot])
  return (
    <div className="tree-item tree-item--renaming" style={{ paddingLeft }}>
      <span className="tree-icon" />
      <input ref={inputRef} className="tree-rename-input" value={value} placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) { e.stopPropagation(); onConfirm(value.trim()) }
          if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
        }}
        onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel() }}
        onClick={e => e.stopPropagation()} />
    </div>
  )
}

function FlatPanel({ rootPath, currentFilePath, sortMode, refreshKey, locale, onFileOpen }: {
  rootPath:        string
  currentFilePath: string | null
  sortMode:        SortMode
  refreshKey:      number
  locale:          Locale
  onFileOpen:      (path: string, content: string) => void
}): React.JSX.Element {
  const [files, setFiles] = useState<FlatFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const collected = await collectFiles(rootPath, rootPath)
    const sorted = collected.sort((a, b) => {
      if (sortMode === 'az')   return a.name.localeCompare(b.name)
      if (sortMode === 'za')   return b.name.localeCompare(a.name)
      return a.name.localeCompare(b.name)
    })
    setFiles(sorted)
    setLoading(false)
  }, [rootPath, sortMode])

  useEffect(() => { load() }, [load, refreshKey])

  const handleClick = useCallback(async (file: FlatFile) => {
    const result = await window.api.openPath(file.path)
    if (result.success && result.content !== undefined && result.path) onFileOpen(result.path, result.content)
  }, [onFileOpen])

  if (loading) return <div className="sidebar-empty" style={{ fontSize: 12 }}>{t('sidebar.loading', locale)}</div>
  if (files.length === 0) return <div className="sidebar-empty"><p>{t('sidebar.noFiles', locale)}</p></div>

  return (
    <div className="sidebar-tree">
      {files.map(file => (
        <div
          key={file.path}
          className={`tree-item ${file.path === currentFilePath ? 'tree-item--active' : ''}`}
          style={{ paddingLeft: 12, gap: 6, justifyContent: 'space-between' }}
          onClick={() => handleClick(file)}
          title={file.path}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <IconFile name={file.name} />
            <span className="tree-name">{file.name}</span>
          </div>
          {file.relDir && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)', paddingRight: 4 }}>
              {file.relDir}/
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

type CreatingInDir = { parentPath: string; type: 'file' | 'dir' }

function TreeNode({ entry, currentFilePath, onFileClick, onContextMenu, renamingPath, onRenameConfirm, onRenameCancel, depth, sortMode, creatingInDir, onNewFileConfirm, onNewDirConfirm, onNewCancel, dragState, onDragStart, onDrop, onDragEnd, refreshKey, locale }: {
  entry: FileEntry; currentFilePath: string | null
  onFileClick: (e: FileEntry) => void; onContextMenu: (ev: React.MouseEvent, e: FileEntry) => void
  renamingPath: string | null; onRenameConfirm: (e: FileEntry, n: string) => void; onRenameCancel: () => void
  depth: number; sortMode: SortMode
  creatingInDir: CreatingInDir | null
  onNewFileConfirm: (parentPath: string, name: string) => void
  onNewDirConfirm:  (parentPath: string, name: string) => void
  onNewCancel: () => void
  dragState: React.MutableRefObject<DragState>
  onDragStart: (entry: FileEntry, ev: React.DragEvent) => void
  onDrop:      (targetEntry: FileEntry) => void
  onDragEnd:   () => void
  refreshKey:  number
  locale: Locale
}): React.JSX.Element {
  const [expanded, setExpanded]         = useState(false)
  const [children, setChildren]         = useState<FileEntry[]>([])
  const [isDropTarget, setIsDropTarget] = useState(false)
  const hoverTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isActive   = entry.path === currentFilePath
  const isRenaming = renamingPath === entry.path
  const isDragging = dragState.current.entry?.path === entry.path

  const sortList = useCallback((list: FileEntry[]): FileEntry[] => {
    const dirs = list.filter(e => e.isDirectory); const files = list.filter(e => !e.isDirectory)
    const sort = (arr: FileEntry[]) => {
      if (sortMode === 'az')   return [...arr].sort((a, b) => a.name.localeCompare(b.name))
      if (sortMode === 'za')   return [...arr].sort((a, b) => b.name.localeCompare(a.name))
      if (sortMode === 'date') return [...arr].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
      return arr
    }
    return [...sort(dirs), ...sort(files)]
  }, [sortMode])

  useEffect(() => { if (creatingInDir?.parentPath === entry.path && !expanded) setExpanded(true) }, [creatingInDir, entry.path, expanded])

  const loadChildren = useCallback(async () => {
    const result = await window.api.listDir(entry.path)
    if (result.success && result.entries) setChildren(result.entries)
  }, [entry.path])

  useEffect(() => {
    if (expanded) loadChildren()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const handleClick = async () => {
    if (isRenaming) return
    if (entry.isDirectory) { if (!expanded) await loadChildren(); setExpanded(v => !v) }
    else { onFileClick(entry) }
  }

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
  }

  const getDropDir = (): string =>
    entry.isDirectory ? entry.path : entry.path.replace(/[\\\/][^\\\/]+$/, '')

  const isValidDropTarget = (): boolean => {
    const src = dragState.current.entry
    if (!src) return false
    if (src.path === entry.path) return false
    const dropDir = getDropDir()
    if (dropDir === src.path || dropDir.startsWith(src.path + '\\') || dropDir.startsWith(src.path + '/')) return false
    const srcDir = src.path.replace(/[\\\/][^\\\/]+$/, '')
    if (dropDir === srcDir) return false
    return true
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!isValidDropTarget()) { e.dataTransfer.dropEffect = 'none'; setIsDropTarget(false); clearHoverTimer(); return }
    e.dataTransfer.dropEffect = 'move'
    setIsDropTarget(true)
    if (entry.isDirectory && !expanded && !hoverTimerRef.current) {
      hoverTimerRef.current = setTimeout(async () => {
        hoverTimerRef.current = null
        await loadChildren()
        setExpanded(true)
      }, HOVER_EXPAND_DELAY)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => { e.stopPropagation(); setIsDropTarget(false); clearHoverTimer() }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setIsDropTarget(false); clearHoverTimer()
    if (!isValidDropTarget()) return
    onDrop(entry)
  }

  if (isRenaming) {
    return (
      <div className="tree-node">
        <InlineInput initialValue={entry.name} selectUpToLastDot={!entry.isDirectory} paddingLeft={12 + depth * 14}
          onConfirm={n => onRenameConfirm(entry, n)} onCancel={onRenameCancel} />
      </div>
    )
  }

  const showCreatingInside = creatingInDir?.parentPath === entry.path && expanded

  return (
    <div className="tree-node">
      <div
        className={[
          'tree-item',
          isActive          ? 'tree-item--active'     : '',
          entry.isDirectory ? 'tree-item--dir'         : '',
          isDragging        ? 'tree-item--dragging'    : '',
          isDropTarget      ? 'tree-item--drop-target' : '',
        ].filter(Boolean).join(' ')}
        style={{ paddingLeft: `${12 + depth * 14}px`, gap: 4 }}
        draggable
        onClick={handleClick}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, entry) }}
        onDragStart={e => { e.stopPropagation(); onDragStart(entry, e) }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={() => { setIsDropTarget(false); clearHoverTimer(); onDragEnd() }}
        title={entry.path}
      >
        <span style={{ width: 10, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'center' }}>
          {entry.isDirectory ? (expanded ? '▾' : '▸') : ''}
        </span>
        {entry.isDirectory ? <IconFolder open={expanded} /> : <IconFile name={entry.name} />}
        <span className="tree-name">{entry.name}</span>
      </div>

      {entry.isDirectory && expanded && (
        <div className="tree-children">
          {showCreatingInside && creatingInDir?.type === 'file' && (
            <InlineInput initialValue={t('sidebar.newFileDefault', locale)} selectUpToLastDot paddingLeft={12 + (depth + 1) * 14}
              onConfirm={n => onNewFileConfirm(entry.path, n)} onCancel={onNewCancel} />
          )}
          {showCreatingInside && creatingInDir?.type === 'dir' && (
            <InlineInput initialValue={t('sidebar.newDirDefault', locale)} paddingLeft={12 + (depth + 1) * 14}
              onConfirm={n => onNewDirConfirm(entry.path, n)} onCancel={onNewCancel} />
          )}
          {sortList(children).map(child => (
            <TreeNode key={child.path} entry={child} currentFilePath={currentFilePath}
              onFileClick={onFileClick} onContextMenu={onContextMenu}
              renamingPath={renamingPath} onRenameConfirm={onRenameConfirm} onRenameCancel={onRenameCancel}
              depth={depth + 1} sortMode={sortMode}
              creatingInDir={creatingInDir} onNewFileConfirm={onNewFileConfirm} onNewDirConfirm={onNewDirConfirm} onNewCancel={onNewCancel}
              dragState={dragState} onDragStart={onDragStart} onDrop={onDrop} onDragEnd={onDragEnd}
              refreshKey={refreshKey}
              locale={locale}
            />
          ))}
          {children.length === 0 && !showCreatingInside && (
            <div className="tree-empty" style={{ paddingLeft: `${12 + (depth + 1) * 14}px` }}>{t('sidebar.empty', locale)}</div>
          )}
        </div>
      )}
    </div>
  )
}

interface HeadingItem { level: number; text: string; index: number }

function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split('\n'); const items: HeadingItem[] = []; let index = 0; let inFence = false
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
  for (const h of headings) { if (h.textContent?.trim() === text) { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); return } }
}

function OutlinePanel({ markdown, locale }: { markdown: string; locale: Locale }): React.JSX.Element {
  const headings = extractHeadings(markdown)
  if (headings.length === 0) return (
    <div className="sidebar-empty">
      <p>{t('sidebar.outlineEmpty', locale)}</p>
      <p style={{ fontSize: 12, marginTop: 8 }}>{t('sidebar.outlineHint', locale)}</p>
    </div>
  )
  const minLevel = Math.min(...headings.map(h => h.level))
  return (
    <div className="outline-list">
      {headings.map(h => (
        <div key={h.index} className={`outline-item outline-item--h${h.level}`}
          style={{ paddingLeft: `${8 + (h.level - minLevel) * 14}px` }}
          onClick={() => scrollToHeading(h.text)} title={h.text}>
          <span className="outline-bullet">{h.level === 1 ? '■' : h.level === 2 ? '▪' : '·'}</span>
          <span className="outline-text">{h.text}</span>
        </div>
      ))}
    </div>
  )
}

function RecentPanel({ files, currentFilePath, locale, onFileOpen }: {
  files: RecentFile[]; currentFilePath: string | null
  locale: Locale
  onFileOpen: (path: string, content: string) => void
}): React.JSX.Element {
  const handleClick = useCallback(async (r: RecentFile) => {
    const result = await window.api.openPath(r.path)
    if (result.success && result.content !== undefined && result.path) onFileOpen(result.path, result.content)
  }, [onFileOpen])
  if (files.length === 0) return (
    <div className="sidebar-empty">
      <p>{t('sidebar.recentEmpty', locale)}</p>
      <p style={{ fontSize: 12, marginTop: 8 }}>{t('sidebar.recentHint', locale)}</p>
    </div>
  )
  return (
    <div className="sidebar-tree">
      {files.map(r => (
        <div key={r.path} className={`tree-item ${r.path === currentFilePath ? 'tree-item--active' : ''}`}
          style={{ paddingLeft: '12px' }} onClick={() => handleClick(r)} title={r.path}>
          <span className="tree-icon" /><span className="tree-name">{r.name}</span>
        </div>
      ))}
    </div>
  )
}

function ConfirmDelete({ name, locale, onConfirm, onCancel }: {
  name: string; locale: Locale; onConfirm: () => void; onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="confirm-delete">
      <p className="confirm-delete-msg">{t('confirm.trashMsg', locale)} <strong>{name}</strong>?</p>
      <div className="confirm-delete-actions">
        <button className="confirm-delete-btn" onClick={onCancel}>{t('confirm.cancel', locale)}</button>
        <button className="confirm-delete-btn confirm-delete-btn--danger" onClick={onConfirm}>{t('confirm.trash', locale)}</button>
      </div>
    </div>
  )
}

const SORT_LABELS: Record<SortMode, string> = { az: 'A→Z', za: 'Z→A', date: '🕐' }
const SORT_NEXT:  Record<SortMode, SortMode> = { az: 'za', za: 'date', date: 'az' }

type Tab = 'files' | 'outline' | 'recent'

export function Sidebar({ currentFilePath, currentMarkdown, recentFiles, onFileOpen, onDirChange, onFileDelete, onFileRename, locale }: SidebarProps): React.JSX.Element {
  const [tab, setTab]                   = useState<Tab>('files')
  const [entries, setEntries]           = useState<FileEntry[]>([])
  const [sortMode, setSortMode]         = useState<SortMode>('az')
  const [viewMode, setViewMode]         = useState<ViewMode>('tree')
  const [contextMenu, setContextMenu]   = useState<ContextMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null)
  const [creatingRoot, setCreatingRoot]   = useState<'file' | 'dir' | null>(null)
  const [creatingInDir, setCreatingInDir] = useState<CreatingInDir | null>(null)
  const [refreshKey, setRefreshKey]       = useState(0)
  const rootDirPathRef  = useRef<string | null>(null)
  const [rootDirName, setRootDirName]   = useState<string>('')
  const dragState   = useRef<DragState>({ entry: null, targetPath: null })
  const [, forceUpdate] = useState(0)

  const sortEntries = useCallback((list: FileEntry[]): FileEntry[] => {
    const dirs = list.filter(e => e.isDirectory); const files = list.filter(e => !e.isDirectory)
    const sort = (arr: FileEntry[]) => {
      if (sortMode === 'az')   return [...arr].sort((a, b) => a.name.localeCompare(b.name))
      if (sortMode === 'za')   return [...arr].sort((a, b) => b.name.localeCompare(a.name))
      if (sortMode === 'date') return [...arr].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
      return arr
    }
    return [...sort(dirs), ...sort(files)]
  }, [sortMode])

  const applyRoot = useCallback((path: string, ents: FileEntry[]) => {
    rootDirPathRef.current = path
    setEntries(ents)
    setRootDirName(path.split(/[\\\/]/).pop() ?? path)
    onDirChange(path)
  }, [onDirChange])

  const refreshRoot = useCallback(async () => {
    const root = rootDirPathRef.current; if (!root) return
    const result = await window.api.listDir(root)
    if (result.success && result.entries) {
      setEntries(result.entries)
      setRefreshKey(k => k + 1)
    }
  }, [])

  useEffect(() => {
    if (!currentFilePath) return
    if (rootDirPathRef.current) return
    const dir = currentFilePath.replace(/[\\\/][^\\\/]+$/, '')
    window.api.listDir(dir).then(result => {
      if (result.success && result.entries) applyRoot(dir, result.entries)
    })
  }, [currentFilePath, applyRoot])

  const handleOpenDir = useCallback(async () => {
    const result = await window.api.openDir()
    if (result.success && result.entries && result.dirPath) applyRoot(result.dirPath, result.entries)
  }, [applyRoot])

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    const result = await window.api.openPath(entry.path)
    if (result.success && result.content !== undefined && result.path) onFileOpen(result.path, result.content)
  }, [onFileOpen])

  const handleNewFileRoot = useCallback(async (name: string) => {
    const root = rootDirPathRef.current; if (!root) return
    setCreatingRoot(null)
    const result = await window.api.newFile(root, name)
    if (result.success && result.path !== undefined) { await refreshRoot(); onFileOpen(result.path, result.content ?? '') }
  }, [refreshRoot, onFileOpen])

  const handleNewDirRoot = useCallback(async (name: string) => {
    const root = rootDirPathRef.current; if (!root) return
    setCreatingRoot(null)
    const result = await window.api.newDir(root, name)
    if (result.success) await refreshRoot()
  }, [refreshRoot])

  const handleNewFileInDir = useCallback(async (parentPath: string, name: string) => {
    setCreatingInDir(null)
    const result = await window.api.newFile(parentPath, name)
    if (result.success && result.path) { await refreshRoot(); onFileOpen(result.path, result.content ?? '') }
  }, [refreshRoot, onFileOpen])

  const handleNewDirInDir = useCallback(async (parentPath: string, name: string) => {
    setCreatingInDir(null)
    const result = await window.api.newDir(parentPath, name)
    if (result.success) await refreshRoot()
  }, [refreshRoot])

  const handleRenameConfirm = useCallback(async (entry: FileEntry, newName: string) => {
    setRenamingPath(null)
    const result = await window.api.renameFile(entry.path, newName)
    if (result.success && result.newPath) {
      await refreshRoot()
      if (entry.path === currentFilePath && result.newPath) onFileRename?.(entry.path, result.newPath)
    }
  }, [currentFilePath, refreshRoot, onFileRename])

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return
    const entry = confirmDelete; setConfirmDelete(null)
    const result = await window.api.deleteFile(entry.path)
    if (result.success) {
      await refreshRoot()
      if (entry.path === currentFilePath) onFileDelete?.(entry.path)
    }
  }, [confirmDelete, currentFilePath, refreshRoot, onFileDelete])

  const handleReveal   = useCallback((entry: FileEntry) => { window.api.revealInExplorer(entry.path) }, [])
  const handleCopyPath = useCallback((entry: FileEntry) => { window.api.copyPath(entry.path) }, [])

  const handleDragStart = useCallback((entry: FileEntry, ev: React.DragEvent) => {
    dragState.current = { entry, targetPath: null }
    ev.dataTransfer.setData(SIDEBAR_DRAG_KEY, entry.path)
    ev.dataTransfer.setData('typeshu/isdir', entry.isDirectory ? '1' : '0')
    ev.dataTransfer.effectAllowed = 'move'
    forceUpdate(n => n + 1)
  }, [])

  const handleDrop = useCallback(async (targetEntry: FileEntry) => {
    const src = dragState.current.entry
    if (!src) return
    const destDir = targetEntry.isDirectory
      ? targetEntry.path
      : targetEntry.path.replace(/[\\\/][^\\\/]+$/, '')
    const result = await window.api.moveFile(src.path, destDir)
    if (result.success && result.newPath) {
      if (src.path === currentFilePath) onFileRename?.(src.path, result.newPath)
    }
    await refreshRoot()
  }, [currentFilePath, onFileRename, refreshRoot])

  const handleDragEnd = useCallback(() => {
    dragState.current = { entry: null, targetPath: null }
    forceUpdate(n => n + 1)
  }, [])

  const headerLabel = tab === 'files'
    ? (rootDirName || t('sidebar.noFolder', locale))
    : tab === 'recent'
      ? t('sidebar.tabRecent', locale)
      : (currentFilePath ? currentFilePath.split(/[\\\/]/).pop() : t('sidebar.tabOutline', locale))

  const rootDirPath = rootDirPathRef.current

  const sortTitles: Record<SortMode, string> = {
    az: t('sidebar.sortAZ', locale),
    za: t('sidebar.sortZA', locale),
    date: t('sidebar.sortDate', locale),
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={`sidebar-tab${tab === 'files'   ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('files')}>{t('sidebar.tabFiles', locale)}</button>
        <button className={`sidebar-tab${tab === 'outline' ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('outline')}>{t('sidebar.tabOutline', locale)}</button>
        <button className={`sidebar-tab${tab === 'recent'  ? ' sidebar-tab--active' : ''}`} onClick={() => setTab('recent')}>{t('sidebar.tabRecent', locale)}</button>
        {tab === 'files' && <button className="sidebar-btn" onClick={handleOpenDir} title={t('sidebar.openFolder', locale)} style={{ marginLeft: 'auto' }}>⊞</button>}
      </div>

      <div className="sidebar-header">
        <span className="sidebar-title" title={rootDirPath ?? ''}>{headerLabel}</span>
        {tab === 'files' && rootDirPath && (
          <>
            <button className="sidebar-btn sidebar-sort-btn" title={sortTitles[SORT_NEXT[sortMode]]} onClick={() => setSortMode(SORT_NEXT[sortMode])}>{SORT_LABELS[sortMode]}</button>
            <button
              className={`sidebar-btn${viewMode === 'tree' ? ' sidebar-btn--active' : ''}`}
              title={t('sidebar.viewTree', locale)}
              onClick={() => setViewMode('tree')}
              aria-pressed={viewMode === 'tree'}
            >
              <IconTreeView />
            </button>
            <button
              className={`sidebar-btn${viewMode === 'flat' ? ' sidebar-btn--active' : ''}`}
              title={t('sidebar.viewFlat', locale)}
              onClick={() => setViewMode('flat')}
              aria-pressed={viewMode === 'flat'}
            >
              <IconFlatList />
            </button>
            {viewMode === 'tree' && (
              <>
                <button className="sidebar-btn" title={t('sidebar.newFile', locale)} onClick={() => { setCreatingRoot('file'); setCreatingInDir(null); setRenamingPath(null) }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                    <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                    <line x1="6" y1="9.5" x2="10" y2="9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    <line x1="8" y1="7.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="sidebar-btn" title={t('sidebar.newDir', locale)} onClick={() => { setCreatingRoot('dir'); setCreatingInDir(null); setRenamingPath(null) }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M1.5 5A1.5 1.5 0 0 1 3 3.5h3L7.5 5H13A1.5 1.5 0 0 1 14.5 6.5V12A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V5z" stroke="currentColor" strokeWidth="1.25"/>
                    <line x1="8" y1="7.5" x2="8" y2="10.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    <line x1="6.5" y1="9" x2="9.5" y2="9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                  </svg>
                </button>
              </>
            )}
          </>
        )}
      </div>

      {confirmDelete && <ConfirmDelete name={confirmDelete.name} locale={locale} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmDelete(null)} />}

      {tab === 'recent' ? (
        <RecentPanel files={recentFiles} currentFilePath={currentFilePath} locale={locale} onFileOpen={onFileOpen} />
      ) : tab === 'outline' ? (
        <div className="sidebar-tree"><OutlinePanel markdown={currentMarkdown} locale={locale} /></div>
      ) : (
        viewMode === 'flat' && rootDirPath ? (
          <FlatPanel
            rootPath={rootDirPath}
            currentFilePath={currentFilePath}
            sortMode={sortMode}
            refreshKey={refreshKey}
            locale={locale}
            onFileOpen={onFileOpen}
          />
        ) : (
          <div className="sidebar-tree">
            {entries.length === 0 && !creatingRoot ? (
              <div className="sidebar-empty">
                <p>{t('sidebar.noFolder', locale)}</p>
                <button className="sidebar-open-btn" onClick={handleOpenDir}>{t('sidebar.openFolder', locale)}</button>
              </div>
            ) : (
              <>
                {creatingRoot === 'file' && <InlineInput initialValue={t('sidebar.newFileDefault', locale)} selectUpToLastDot paddingLeft={12} onConfirm={handleNewFileRoot} onCancel={() => setCreatingRoot(null)} />}
                {creatingRoot === 'dir'  && <InlineInput initialValue={t('sidebar.newDirDefault', locale)} paddingLeft={12} onConfirm={handleNewDirRoot} onCancel={() => setCreatingRoot(null)} />}
                {sortEntries(entries).map(entry => (
                  <TreeNode key={entry.path} entry={entry} currentFilePath={currentFilePath}
                    onFileClick={handleFileClick}
                    onContextMenu={(e, entry) => { setContextMenu({ x: e.clientX, y: e.clientY, entry }); setConfirmDelete(null) }}
                    renamingPath={renamingPath} onRenameConfirm={handleRenameConfirm} onRenameCancel={() => setRenamingPath(null)}
                    depth={0} sortMode={sortMode}
                    creatingInDir={creatingInDir} onNewFileConfirm={handleNewFileInDir} onNewDirConfirm={handleNewDirInDir} onNewCancel={() => setCreatingInDir(null)}
                    dragState={dragState} onDragStart={handleDragStart} onDrop={handleDrop} onDragEnd={handleDragEnd}
                    refreshKey={refreshKey}
                    locale={locale}
                  />
                ))}
              </>
            )}
          </div>
        )
      )}

      {contextMenu && (
        <ContextMenu menu={contextMenu}
          locale={locale}
          onRename={entry => { setRenamingPath(entry.path); setContextMenu(null) }}
          onDelete={entry => { setConfirmDelete(entry); setContextMenu(null) }}
          onReveal={handleReveal} onCopyPath={handleCopyPath}
          onClose={() => setContextMenu(null)} />
      )}
    </aside>
  )
}
