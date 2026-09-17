// [mcp-local harness] feature: fix-menu-channels | plano: 7f4727c6 | 2026-09-17 15:48:23
// Preload com todos os canais do menu Format, View e Export
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

const LISTEN_CHANNELS = [
  IPC.FILE_NEW,
  IPC.FILE_SAVE,
  IPC.FILE_SAVE_AS,
  'file:opened',
  'ui:open-quickly',
  'ui:global-search',
  'ui:export-pdf',
  'ui:export-html',
  // Canais do menu Format
  'format:bold',
  'format:italic',
  'format:heading',
  // Canais do menu View
  'view:toggle-sidebar',
  'view:toggle-source',
  'view:toggle-focus',
  'view:toggle-typewriter',
] as const

type ListenChannel = typeof LISTEN_CHANNELS[number]

contextBridge.exposeInMainWorld('api', {
  openFile:    () => ipcRenderer.invoke(IPC.FILE_OPEN),
  openPath:    (path: string) => ipcRenderer.invoke(IPC.FILE_OPEN_PATH, path),
  saveFile:    (path: string, content: string) => ipcRenderer.invoke(IPC.FILE_SAVE, path, content),
  saveFileAs:  (content: string) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, content),
  listDir:     (dirPath: string) => ipcRenderer.invoke(IPC.DIR_LIST, dirPath),
  openDir:     () => ipcRenderer.invoke(IPC.DIR_OPEN),
  searchFiles: (dirPath: string, query: string, caseSensitive?: boolean) =>
    ipcRenderer.invoke(IPC.SEARCH_FILES, dirPath, query, caseSensitive ?? false),
  getPrefs:    () => ipcRenderer.invoke(IPC.PREFS_GET),
  setPrefs:    (p: Record<string, unknown>) => ipcRenderer.invoke(IPC.PREFS_SET, p),

  on: (channel: string, cb: (...args: unknown[]) => void) => {
    if (LISTEN_CHANNELS.includes(channel as ListenChannel)) {
      ipcRenderer.on(channel, (_e, ...args) => cb(...args))
    }
  },
  removeAllListeners: (channel: string) => {
    if (LISTEN_CHANNELS.includes(channel as ListenChannel)) {
      ipcRenderer.removeAllListeners(channel)
    }
  },
})
