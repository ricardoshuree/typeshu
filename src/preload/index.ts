// [mcp-local harness] feature: custom-titlebar | plano: e4a3096f | 2026-09-18
// +windowMinimize/Maximize/Close/isMaximized + NOTIFY.WIN_MAXIMIZED_CHANGED
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
  'ui:preferences',
  'format:bold',
  'format:italic',
  'format:strikethrough',
  'format:link',
  'format:code-fence',
  'format:heading',
  'format:blockquote',
  'format:bullet-list',
  'format:ordered-list',
  'format:table',
  'view:toggle-sidebar',
  'view:toggle-source',
  'view:toggle-focus',
  'view:toggle-typewriter',
  'recent:open',
  NOTIFY.FILE_CHANGED_EXTERNALLY,
  NOTIFY.RECENT_CHANGED,
  NOTIFY.WIN_MAXIMIZED_CHANGED,
] as const

type ListenChannel = typeof LISTEN_CHANNELS[number]

contextBridge.exposeInMainWorld('api', {
  openFile:          () => ipcRenderer.invoke(IPC.FILE_OPEN),
  openPath:          (path: string) => ipcRenderer.invoke(IPC.FILE_OPEN_PATH, path),
  saveFile:          (path: string, content: string) => ipcRenderer.invoke(IPC.FILE_SAVE, path, content),
  saveFileAs:        (content: string) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, content),
  listDir:           (dirPath: string) => ipcRenderer.invoke(IPC.DIR_LIST, dirPath),
  openDir:           () => ipcRenderer.invoke(IPC.DIR_OPEN),
  searchFiles:       (dirPath: string, query: string, caseSensitive?: boolean) =>
    ipcRenderer.invoke(IPC.SEARCH_FILES, dirPath, query, caseSensitive ?? false),
  watchStart:        (path: string) => ipcRenderer.invoke(IPC.WATCH_START, path),
  watchStop:         () => ipcRenderer.invoke(IPC.WATCH_STOP),
  getPrefs:          () => ipcRenderer.invoke(IPC.PREFS_GET),
  setPrefs:          (p: Record<string, unknown>) => ipcRenderer.invoke(IPC.PREFS_SET, p),
  newFile:           (dirPath: string, fileName: string) => ipcRenderer.invoke(IPC.FILE_NEW_IN_DIR, dirPath, fileName),
  newDir:            (parentPath: string, dirName: string) => ipcRenderer.invoke(IPC.DIR_NEW, parentPath, dirName),
  renameFile:        (oldPath: string, newName: string)  => ipcRenderer.invoke(IPC.FILE_RENAME, oldPath, newName),
  moveFile:          (sourcePath: string, destDir: string) => ipcRenderer.invoke(IPC.FILE_MOVE, sourcePath, destDir),
  deleteFile:        (filePath: string) => ipcRenderer.invoke(IPC.FILE_DELETE, filePath),
  revealInExplorer:  (filePath: string) => ipcRenderer.invoke(IPC.FILE_REVEAL, filePath),
  copyPath:          (filePath: string) => ipcRenderer.invoke(IPC.FILE_COPY_PATH, filePath),
  getRecent:         () => ipcRenderer.invoke(IPC.RECENT_GET),
  addRecent:         (filePath: string) => ipcRenderer.invoke(IPC.RECENT_ADD, filePath),

  // Window controls
  windowMinimize:   () => ipcRenderer.invoke(IPC.WIN_MINIMIZE),
  windowMaximize:   () => ipcRenderer.invoke(IPC.WIN_MAXIMIZE),
  windowClose:      () => ipcRenderer.invoke(IPC.WIN_CLOSE),
  windowIsMaximized: () => ipcRenderer.invoke(IPC.WIN_IS_MAXIMIZED),

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

// Notifica renderer quando janela é maximizada/restaurada
ipcRenderer.on('notify:win-maximized-changed', (_e, isMaximized: boolean) => {
  // reemite para o renderer via o canal de listen
})
