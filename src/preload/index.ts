// [mcp-local harness] feature: format-strikethrough-link-codefence-sidebar | plano: ee7b144b | 2026-09-17 17:45:07
// Preload: adiciona format:strikethrough, format:link, format:code-fence à whitelist
// Preload: whitelist com strikethrough, link, code-fence
import { contextBridge, ipcRenderer } from 'electron'
import { IPC, NOTIFY } from '../shared/types'

const LISTEN_CHANNELS = [
  IPC.FILE_NEW,
  IPC.FILE_SAVE,
  IPC.FILE_SAVE_AS,
  'file:opened',
  'ui:open-quickly',
  'ui:global-search',
  'ui:export-pdf',
  'ui:export-html',
  'format:bold',
  'format:italic',
  'format:strikethrough',   // novo
  'format:link',            // novo
  'format:code-fence',      // novo
  'format:heading',
  'view:toggle-sidebar',
  'view:toggle-source',
  'view:toggle-focus',
  'view:toggle-typewriter',
  NOTIFY.FILE_CHANGED_EXTERNALLY,
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
  watchStart:  (path: string) => ipcRenderer.invoke(IPC.WATCH_START, path),
  watchStop:   () => ipcRenderer.invoke(IPC.WATCH_STOP),
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
