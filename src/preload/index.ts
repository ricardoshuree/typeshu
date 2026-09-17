// [mcp-local harness] feature: fix-quickopen-channel | plano: 2d37569e | 2026-09-17 15:12:46
// Adicionar ui:open-quickly à whitelist LISTEN_CHANNELS do preload
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

// Canais que o main process pode enviar ao renderer
const LISTEN_CHANNELS = [
  IPC.FILE_NEW,
  IPC.FILE_SAVE,
  IPC.FILE_SAVE_AS,
  'file:opened',
  'ui:open-quickly',   // ← Ctrl+P abre o modal QuickOpen
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
