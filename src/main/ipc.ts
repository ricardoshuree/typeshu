// [mcp-local harness] feature: sidebar-filetree | plano: de4bef30 | 2026-09-17 13:40:26
// ipc.ts com handlers DIR_LIST e DIR_OPEN para listar diretórios
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { IPC, DEFAULT_PREFERENCES, UserPreferences, FileEntry } from '@shared/types'

let prefs: UserPreferences = { ...DEFAULT_PREFERENCES }

async function readTextFile(filePath: string): Promise<string> {
  const buf = await readFile(filePath)
  if (buf[0] === 0xFF && buf[1] === 0xFE) return buf.slice(2).toString('utf16le')
  if (buf[0] === 0xFE && buf[1] === 0xFF) {
    const swapped = Buffer.alloc(buf.length - 2)
    for (let i = 2; i < buf.length - 1; i += 2) {
      swapped[i - 2] = buf[i + 1]
      swapped[i - 1] = buf[i]
    }
    return swapped.toString('utf16le')
  }
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return buf.slice(3).toString('utf-8')
  return buf.toString('utf-8')
}

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

async function listDir(dirPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath)
  const result: FileEntry[] = []

  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const fullPath = join(dirPath, name)
    try {
      const s = await stat(fullPath)
      if (s.isDirectory()) {
        result.push({ name, path: fullPath, isDirectory: true })
      } else if (MD_EXTENSIONS.has(extname(name).toLowerCase())) {
        result.push({ name, path: fullPath, isDirectory: false })
      }
    } catch { /* skip */ }
  }

  // Diretórios primeiro, depois arquivos, ambos em ordem alfabética
  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function registerIpcHandlers(): void {

  // ── File: open via dialog ─────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_OPEN, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'Texto',    extensions: ['txt'] },
        { name: 'Todos',    extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return { success: false }
    try {
      const content = await readTextFile(filePaths[0])
      return { success: true, path: filePaths[0], content }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── File: open by path ────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_OPEN_PATH, async (_e, path: string) => {
    try {
      const content = await readTextFile(path)
      return { success: true, path, content }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── File: save ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_SAVE, async (_e, path: string, content: string) => {
    try {
      await writeFile(path, content, 'utf-8')
      return { success: true, path }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── File: save as ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.FILE_SAVE_AS, async (_e, content: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Texto',    extensions: ['txt'] },
      ],
    })
    if (canceled || !filePath) return { success: false }
    try {
      await writeFile(filePath, content, 'utf-8')
      return { success: true, path: filePath }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── Dir: list entries ─────────────────────────────────────────────────
  ipcMain.handle(IPC.DIR_LIST, async (_e, dirPath: string) => {
    try {
      const entries = await listDir(dirPath)
      return { success: true, entries, dirPath }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── Dir: open folder dialog ───────────────────────────────────────────
  ipcMain.handle(IPC.DIR_OPEN, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    if (canceled || !filePaths.length) return { success: false }
    try {
      const entries = await listDir(filePaths[0])
      return { success: true, entries, dirPath: filePaths[0] }
    } catch (e) { return { success: false, error: String(e) } }
  })

  // ── Prefs ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.PREFS_GET, () => prefs)
  ipcMain.handle(IPC.PREFS_SET, (_e, partial: Partial<UserPreferences>) => {
    prefs = { ...prefs, ...partial }
    return prefs
  })
}
