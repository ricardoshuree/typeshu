import React, { useRef } from 'react'
import type { TabState } from '@shared/types'

interface TabBarProps {
  tabs:        TabState[]
  activeTabId: string
  onSwitch:    (id: string) => void
  onClose:     (id: string) => void
  onReorder:   (fromIndex: number, toIndex: number) => void
}

function tabLabel(tab: TabState): string {
  if (!tab.filePath) return 'Untitled'
  return tab.filePath.split(/[\\/]/).pop() ?? 'Untitled'
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose, onReorder }: TabBarProps): React.JSX.Element {
  const dragIndexRef = useRef<number | null>(null)

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    ;(e.currentTarget as HTMLElement).classList.add('tab--drag-over')
  }

  function handleDragLeave(e: React.DragEvent) {
    ;(e.currentTarget as HTMLElement).classList.remove('tab--drag-over')
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).classList.remove('tab--drag-over')
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === toIndex) return
    onReorder(fromIndex, toIndex)
    dragIndexRef.current = null
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    document.querySelectorAll('.tab--drag-over').forEach(el => el.classList.remove('tab--drag-over'))
  }

  return (
    <div className="tab-bar">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            className={`tab${isActive ? ' tab--active' : ''}`}
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSwitch(tab.id)}
            title={tab.filePath ?? 'Untitled'}
          >
            <span className="tab-label">
              {tab.isDirty && <span className="tab-dirty">●</span>}
              {tabLabel(tab)}
            </span>
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); onClose(tab.id) }}
              title="Fechar aba"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
