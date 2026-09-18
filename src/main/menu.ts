// [mcp-local harness] feature: backlog-phase1 | plano: 97306772 | 2026-09-18
// +Open Recent dinâmico; +Format: Blockquote, Bullet List, Ordered List, Table
import { Menu, BrowserWindow, app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { IPC, RecentFile } from '../shared/types'

const RESULT = {
  FILE_OPENED:    'file:opened',
  OPEN_QUICKLY:   'ui:open-quickly',
  GLOBAL_SEARCH:  'ui:global-search',
  EXPORT_PDF:     'ui:export-pdf',
  EXPORT_HTML:    'ui:export-html',
  PREFERENCES:    'ui:preferences',
} as const

const RECENT_MAX  = 10
const recentPath  = () => join(app.getPath('userData'), 'recent.json')

async function loadRecent(): Promise<RecentFile[]> {
  try { return JSON.parse(await readFile(recentPath(), 'utf-8')) as RecentFile[] }
  catch { return [] }
}

function getWin(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

async function openFile(): Promise<void> {
  const win = getWin(); if (!win) return
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
  const win = getWin(); if (!win) return null
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Texto', extensions: ['txt'] }],
  })
  if (canceled || !filePath) return null
  await writeFile(filePath, content, 'utf-8')
  return filePath
}

function buildRecentSubmenu(recent: RecentFile[]): Electron.MenuItemConstructorOptions[] {
  if (recent.length === 0) {
    return [{ label: 'Nenhum arquivo recente', enabled: false }]
  }
  const items: Electron.MenuItemConstructorOptions[] = recent.map(r => ({
    label: r.name,
    sublabel: r.path,
    click: async () => {
      const win = getWin(); if (!win) return
      try {
        const content = await readFile(r.path, 'utf-8')
        win.webContents.send(RESULT.FILE_OPENED, { success: true, path: r.path, content })
        // notifica renderer para registrar no histórico
        win.webContents.send('recent:open', r.path)
      } catch {
        win.webContents.send(RESULT.FILE_OPENED, { success: false, error: `Não foi possível abrir: ${r.path}` })
      }
    },
  }))
  items.push({ type: 'separator' })
  items.push({
    label: 'Limpar recentes',
    click: async () => {
      try { await writeFile(recentPath(), '[]', 'utf-8') } catch {}
      buildMenu()  // reconstrói menu sem itens recentes
      getWin()?.webContents.send('notify:recent-changed', [])
    },
  })
  return items
}

export async function buildMenu(): Promise<void> {
  const recent = await loadRecent()

  const template: Electron.MenuItemConstructorOptions[] = [
    // ── File ──────────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        { label: 'New',          accelerator: 'CmdOrCtrl+N',       click: () => getWin()?.webContents.send(IPC.FILE_NEW) },
        { type: 'separator' },
        { label: 'Open...',      accelerator: 'CmdOrCtrl+O',       click: () => openFile() },
        { label: 'Open Quickly', accelerator: 'CmdOrCtrl+P',       click: () => getWin()?.webContents.send(RESULT.OPEN_QUICKLY) },
        { label: 'Open Recent',  submenu: buildRecentSubmenu(recent) },
        { type: 'separator' },
        { label: 'Save',         accelerator: 'CmdOrCtrl+S',       click: () => getWin()?.webContents.send(IPC.FILE_SAVE) },
        { label: 'Save As...',   accelerator: 'CmdOrCtrl+Shift+S', click: () => getWin()?.webContents.send(IPC.FILE_SAVE_AS) },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            { label: 'Export as PDF...',  accelerator: 'CmdOrCtrl+Shift+E', click: () => getWin()?.webContents.send(RESULT.EXPORT_PDF) },
            { label: 'Export as HTML...', click: () => getWin()?.webContents.send(RESULT.EXPORT_HTML) },
          ],
        },
        { type: 'separator' },
        { label: 'Preferences',  accelerator: 'CmdOrCtrl+,',       click: () => getWin()?.webContents.send(RESULT.PREFERENCES) },
        { type: 'separator' },
        { label: 'Quit', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() },
      ],
    },

    // ── Edit ──────────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo',          accelerator: 'CmdOrCtrl+Z',       role: 'undo' },
        { label: 'Redo',          accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut',           accelerator: 'CmdOrCtrl+X',       role: 'cut' },
        { label: 'Copy',          accelerator: 'CmdOrCtrl+C',       role: 'copy' },
        { label: 'Paste',         accelerator: 'CmdOrCtrl+V',       role: 'paste' },
        { type: 'separator' },
        { label: 'Select All',    accelerator: 'CmdOrCtrl+A',       role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find',          accelerator: 'CmdOrCtrl+F',       click: () => getWin()?.webContents.send('ui:find') },
        { label: 'Replace',       accelerator: 'CmdOrCtrl+H',       click: () => getWin()?.webContents.send('ui:replace') },
        { label: 'Find in Files', accelerator: 'CmdOrCtrl+Shift+F', click: () => getWin()?.webContents.send(RESULT.GLOBAL_SEARCH) },
      ],
    },

    // ── Format ────────────────────────────────────────────────────────────
    {
      label: 'Format',
      submenu: [
        { label: 'Bold',          accelerator: 'CmdOrCtrl+B',         click: () => getWin()?.webContents.send('format:bold') },
        { label: 'Italic',        accelerator: 'CmdOrCtrl+I',         click: () => getWin()?.webContents.send('format:italic') },
        { label: 'Strikethrough', accelerator: 'Alt+Shift+5',         click: () => getWin()?.webContents.send('format:strikethrough') },
        { type: 'separator' },
        { label: 'Hyperlink',     accelerator: 'CmdOrCtrl+K',         click: () => getWin()?.webContents.send('format:link') },
        { label: 'Code Fence',    accelerator: 'CmdOrCtrl+Shift+K',   click: () => getWin()?.webContents.send('format:code-fence') },
        { type: 'separator' },
        { label: 'Blockquote',    accelerator: 'CmdOrCtrl+Shift+Q',   click: () => getWin()?.webContents.send('format:blockquote') },
        { label: 'Bullet List',   accelerator: 'CmdOrCtrl+Shift+[',   click: () => getWin()?.webContents.send('format:bullet-list') },
        { label: 'Ordered List',  accelerator: 'CmdOrCtrl+Shift+]',   click: () => getWin()?.webContents.send('format:ordered-list') },
        { label: 'Table',         accelerator: 'CmdOrCtrl+T',         click: () => getWin()?.webContents.send('format:table') },
        { type: 'separator' },
        { label: 'Heading 1',     accelerator: 'CmdOrCtrl+1',         click: () => getWin()?.webContents.send('format:heading', 1) },
        { label: 'Heading 2',     accelerator: 'CmdOrCtrl+2',         click: () => getWin()?.webContents.send('format:heading', 2) },
        { label: 'Heading 3',     accelerator: 'CmdOrCtrl+3',         click: () => getWin()?.webContents.send('format:heading', 3) },
        { label: 'Heading 4',     accelerator: 'CmdOrCtrl+4',         click: () => getWin()?.webContents.send('format:heading', 4) },
        { label: 'Heading 5',     accelerator: 'CmdOrCtrl+5',         click: () => getWin()?.webContents.send('format:heading', 5) },
        { label: 'Heading 6',     accelerator: 'CmdOrCtrl+6',         click: () => getWin()?.webContents.send('format:heading', 6) },
        { label: 'Paragraph',     accelerator: 'CmdOrCtrl+Shift+0',   click: () => getWin()?.webContents.send('format:heading', 0) },
      ],
    },

    // ── View ──────────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar',    accelerator: 'CmdOrCtrl+Shift+L', click: () => getWin()?.webContents.send('view:toggle-sidebar') },
        { label: 'Source Code Mode',  accelerator: 'CmdOrCtrl+/',       click: () => getWin()?.webContents.send('view:toggle-source') },
        { type: 'separator' },
        { label: 'Focus Mode',        accelerator: 'F8',                click: () => getWin()?.webContents.send('view:toggle-focus') },
        { label: 'Typewriter Mode',   accelerator: 'F9',                click: () => getWin()?.webContents.send('view:toggle-typewriter') },
        { label: 'Toggle Fullscreen', accelerator: 'F11',               role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Reload',            accelerator: 'CmdOrCtrl+R',       role: 'reload' },
        { label: 'Toggle DevTools',   accelerator: 'F12',               role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom In',           accelerator: 'CmdOrCtrl+Plus',    role: 'zoomIn' },
        { label: 'Zoom Out',          accelerator: 'CmdOrCtrl+-',       role: 'zoomOut' },
        { label: 'Reset Zoom',        accelerator: 'CmdOrCtrl+0',       role: 'resetZoom' },
      ],
    },

    // ── Window ────────────────────────────────────────────────────────────
    { label: 'Window', role: 'window', submenu: [{ label: 'Minimize', role: 'minimize' }, { label: 'Close', role: 'close' }] },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export { saveFileAs, RESULT }
