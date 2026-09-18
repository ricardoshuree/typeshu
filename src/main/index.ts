// [mcp-local harness] feature: backlog-phase1 | plano: 1f0b6534 | 2026-09-18
// buildMenu agora é async (lê recent.json) — await na chamada
import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { buildMenu } from './menu'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 640, minHeight: 480,
    backgroundColor: '#1e1e1e', titleBarStyle: 'hiddenInset', show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
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
  await buildMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
