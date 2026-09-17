// [mcp-local harness] feature: sidebar-filetree | plano: de4bef30 | 2026-09-17 13:40:36
// Preload com listDir e openDir expostos via contextBridge
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

const LISTEN_CHANNELS = [
  IPC.FILE_NEW,
  IPC.FILE_SAVE,
  IPC.FILE_SAVE_AS,
  'file:opened',
] as const

type ListenChannel = typeof LISTEN_CHANNELS[number]

contextBridge.exposeInMainWorld('api', {
  // ── renderer → main ──────────────────────────────────────────────────
  openFile:   () => ipcRenderer.invoke(IPC.FILE_OPEN),
  openPath:   (path: string) => ipcRenderer.invoke(IPC.FILE_OPEN_PATH, path),
  saveFile:   (path: string, content: string) => ipcRenderer.invoke(IPC.FILE_SAVE, path, content),
  saveFileAs: (content: string) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, content),
  listDir:    (dirPath: string) => ipcRenderer.invoke(IPC.DIR_LIST, dirPath),
  openDir:    () => ipcRenderer.invoke(IPC.DIR_OPEN),
  getPrefs:   () => ipcRenderer.invoke(IPC.PREFS_GET),
  setPrefs:   (p: Record<string, unknown>) => ipcRenderer.invoke(IPC.PREFS_SET, p),

  // ── main → renderer ──────────────────────────────────────────────────
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
