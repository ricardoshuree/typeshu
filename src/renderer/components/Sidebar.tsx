// [mcp-local harness] feature: sidebar-filetree | plano: de4bef30 | 2026-09-17 13:40:54
// Componente Sidebar com File Tree navegável e abertura de pasta
import React, { useState, useEffect, useCallback } from 'react'
import type { FileEntry, DirListResult } from '@shared/types'

declare const window: Window & {
  api: {
    listDir: (dirPath: string) => Promise<DirListResult>
    openDir: () => Promise<DirListResult>
    openPath: (path: string) => Promise<{ success: boolean; path?: string; content?: string }>
  }
}

interface SidebarProps {
  currentFilePath: string | null
  onFileOpen: (path: string, content: string) => void
}

interface TreeNodeProps {
  entry: FileEntry
  currentFilePath: string | null
  onFileClick: (entry: FileEntry) => void
  depth: number
}

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

export function Sidebar({ currentFilePath, onFileOpen }: SidebarProps): React.JSX.Element {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [dirPath, setDirPath] = useState<string | null>(null)
  const [dirName, setDirName] = useState<string>('Nenhuma pasta')

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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title" title={dirPath ?? ''}>{dirName}</span>
        <button className="sidebar-btn" onClick={handleOpenDir} title="Abrir pasta">
          ⊞
        </button>
      </div>
      <div className="sidebar-tree">
        {entries.length === 0 ? (
          <div className="sidebar-empty">
            <p>Nenhuma pasta aberta</p>
            <button className="sidebar-open-btn" onClick={handleOpenDir}>
              Abrir pasta
            </button>
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
        )}
      </div>
    </aside>
  )
}
