// [mcp-local harness] feature: vscode-borders | plano: 3ec4464c | 2026-09-18
// backgroundColor sólido #323233 + roundedCorners:true — sem transparent
import { app, BrowserWindow, shell, session, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater } from './updater'
import { NOTIFY } from '../shared/types'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 640, minHeight: 480,
    backgroundColor: '#323233',
    frame: false,
    titleBarStyle: 'hidden',
    roundedCorners: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    }
  })

  Menu.setApplicationMenu(null)

  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })

  win.on('maximize',   () => win.webContents.send(NOTIFY.WIN_MAXIMIZED_CHANGED, true))
  win.on('unmaximize', () => win.webContents.send(NOTIFY.WIN_MAXIMIZED_CHANGED, false))

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  win.once('ready-to-show', () => win.show())
  return win
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "worker-src blob:; " +
          "font-src 'self' data:"
        ],
      },
    })
  })
  registerIpcHandlers()
  createWindow()
  initAutoUpdater()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
