// [mcp-local harness] feature: global-search | plano: f149f65d | 2026-09-17 15:32:43
// Preload com searchFiles e canal ui:global-search na whitelist
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

const LISTEN_CHANNELS = [
  IPC.FILE_NEW,
  IPC.FILE_SAVE,
  IPC.FILE_SAVE_AS,
  'file:opened',
  'ui:open-quickly',
  'ui:global-search',   // ← Ctrl+Shift+F abre o painel Global Search
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
