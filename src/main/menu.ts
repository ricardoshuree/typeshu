// [mcp-local harness] feature: global-search | plano: f149f65d | 2026-09-17 15:33:02
// Menu com Find in Files Ctrl+Shift+F → envia ui:global-search
// Menu com Ctrl+P (Open Quickly) e Ctrl+Shift+F (Global Search)
import { Menu, BrowserWindow, app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { IPC } from '../shared/types'

const RESULT = {
  FILE_OPENED:    'file:opened',
  FILE_SAVED:     'file:saved',
  OPEN_QUICKLY:   'ui:open-quickly',
  GLOBAL_SEARCH:  'ui:global-search',
} as const

function getWin(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

async function openFile(): Promise<void> {
  const win = getWin()
  if (!win) return
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Texto',    extensions: ['txt'] },
      { name: 'Todos',    extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return
  try {
    const content = await readFile(filePaths[0], 'utf-8')
    win.webContents.send(RESULT.FILE_OPENED, { success: true, path: filePaths[0], content })
  } catch (e) {
    win.webContents.send(RESULT.FILE_OPENED, { success: false, error: String(e) })
  }
}

async function saveFileAs(content: string): Promise<string | null> {
  const win = getWin()
  if (!win) return null
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Texto', extensions: ['txt'] }],
  })
  if (canceled || !filePath) return null
  await writeFile(filePath, content, 'utf-8')
  return filePath
}

export function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New',          accelerator: 'CmdOrCtrl+N',       click: () => getWin()?.webContents.send(IPC.FILE_NEW) },
        { type: 'separator' },
        { label: 'Open...',      accelerator: 'CmdOrCtrl+O',       click: () => openFile() },
        { label: 'Open Quickly', accelerator: 'CmdOrCtrl+P',       click: () => getWin()?.webContents.send(RESULT.OPEN_QUICKLY) },
        { type: 'separator' },
        { label: 'Save',         accelerator: 'CmdOrCtrl+S',       click: () => getWin()?.webContents.send(IPC.FILE_SAVE) },
        { label: 'Save As...',   accelerator: 'CmdOrCtrl+Shift+S', click: () => getWin()?.webContents.send(IPC.FILE_SAVE_AS) },
        { type: 'separator' },
        { label: 'Quit', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo',         accelerator: 'CmdOrCtrl+Z',       role: 'undo' },
        { label: 'Redo',         accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut',          accelerator: 'CmdOrCtrl+X',       role: 'cut' },
        { label: 'Copy',         accelerator: 'CmdOrCtrl+C',       role: 'copy' },
        { label: 'Paste',        accelerator: 'CmdOrCtrl+V',       role: 'paste' },
        { type: 'separator' },
        { label: 'Select All',   accelerator: 'CmdOrCtrl+A',       role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Files', accelerator: 'CmdOrCtrl+Shift+F', click: () => getWin()?.webContents.send(RESULT.GLOBAL_SEARCH) },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload',            accelerator: 'CmdOrCtrl+R',    role: 'reload' },
        { label: 'Toggle DevTools',   accelerator: 'F12',            role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom In',           accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out',          accelerator: 'CmdOrCtrl+-',    role: 'zoomOut' },
        { label: 'Reset Zoom',        accelerator: 'CmdOrCtrl+0',    role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11',            role: 'togglefullscreen' },
      ],
    },
    { label: 'Window', role: 'window', submenu: [{ label: 'Minimize', role: 'minimize' }, { label: 'Close', role: 'close' }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export { saveFileAs, RESULT }
