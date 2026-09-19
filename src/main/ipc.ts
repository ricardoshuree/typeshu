// +handlers WIN_MINIMIZE/MAXIMIZE/CLOSE/IS_MAXIMIZED
import { ipcMain, dialog, BrowserWindow, shell, app, clipboard } from 'electron'
import { readFile, writeFile, readdir, stat, rename, mkdir, copyFile } from 'fs/promises'
import { join, extname, relative, dirname, basename } from 'path'
import { IPC, NOTIFY, DEFAULT_PREFERENCES, UserPreferences, FileEntry, RecentFile, SearchFileResult, SearchResult } from '../shared/types'

type FSWatcher = { close(): Promise<void> }

const RECENT_MAX = 10
const recentPath = () => join(app.getPath('userData'), 'recent.json')

async function loadRecent(): Promise<RecentFile[]> {
  try { const raw = await readFile(recentPath(), 'utf-8'); return JSON.parse(raw) as RecentFile[] }
  catch { return [] }
}

async function saveRecent(list: RecentFile[]): Promise<void> {
  try { await writeFile(recentPath(), JSON.stringify(list), 'utf-8') } catch {}
}

async function addRecent(filePath: string): Promise<RecentFile[]> {
  const name = basename(filePath)
  let list = await loadRecent()
  list = list.filter(r => r.path !== filePath)
  list.unshift({ path: filePath, name })
  if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX)
  await saveRecent(list)
  return list
}

let prefs: UserPreferences = { ...DEFAULT_PREFERENCES }
let currentWatcher: FSWatcher | null = null
let watchedPath: string | null = null
let ignoreNextChange = false

async function stopWatch(): Promise<void> {
  if (currentWatcher) { await currentWatcher.close(); currentWatcher = null; watchedPath = null }
}

async function startWatch(filePath: string): Promise<void> {
  if (watchedPath === filePath) return
  await stopWatch()
  watchedPath = filePath
  try {
    const chokidar = await import('chokidar')
    const watcher  = chokidar.watch(filePath, {
      persistent: false, ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    })
    watcher.on('change', () => {
      if (ignoreNextChange) { ignoreNextChange = false; return }
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send(NOTIFY.FILE_CHANGED_EXTERNALLY, { path: filePath })
    })
    currentWatcher = watcher as unknown as FSWatcher
  } catch (e) { console.error('[watch] falha ao iniciar chokidar:', e) }
}

async function readTextFile(filePath: string): Promise<string> {
  const buf = await readFile(filePath)
  if (buf[0] === 0xFF && buf[1] === 0xFE) return buf.slice(2).toString('utf16le')
  if (buf[0] === 0xFE && buf[1] === 0xFF) {
    const swapped = Buffer.alloc(buf.length - 2)
    for (let i = 2; i < buf.length - 1; i += 2) { swapped[i - 2] = buf[i + 1]; swapped[i - 1] = buf[i] }
    return swapped.toString('utf16le')
  }
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return buf.slice(3).toString('utf-8')
  return buf.toString('utf-8')
}

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
const SKIP_DIRS     = new Set(['node_modules', '.git', 'dist', 'release', '.cache'])

async function listDir(dirPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath)
  const result: FileEntry[] = []
  for (const name of entries) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const fullPath = join(dirPath, name)
    try {
      const s = await stat(fullPath)
      if (s.isDirectory()) {
        result.push({ name, path: fullPath, isDirectory: true, mtime: s.mtimeMs })
      } else if (MD_EXTENSIONS.has(extname(name).toLowerCase())) {
        result.push({ name, path: fullPath, isDirectory: false, mtime: s.mtimeMs })
      }
    } catch { /* skip */ }
  }
  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

async function searchInFiles(
  dirPath: string, rootPath: string, query: string,
  caseSensitive: boolean, depth = 0, maxDepth = 4
): Promise<SearchFileResult[]> {
  if (depth > maxDepth) return []
  let entries: string[]
  try { entries = await readdir(dirPath) } catch { return [] }
  const results: SearchFileResult[] = []
  const q = caseSensitive ? query : query.toLowerCase()
  for (const name of entries) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
    const fullPath = join(dirPath, name)
    let s: Awaited<ReturnType<typeof stat>>
    try { s = await stat(fullPath) } catch { continue }
    if (s.isDirectory()) {
      results.push(...await searchInFiles(fullPath, rootPath, query, caseSensitive, depth + 1, maxDepth))
    } else if (MD_EXTENSIONS.has(extname(name).toLowerCase())) {
      try {
        const content = await readTextFile(fullPath)
        const lines = content.split('\n')
        const matches = []
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]; const search = caseSensitive ? line : line.toLowerCase()
          let pos = 0
          while (true) {
            const idx = search.indexOf(q, pos); if (idx < 0) break
            const trimmed = line.trim(); const trimOffset = line.length - line.trimStart().length
            matches.push({ lineNumber: i + 1, lineText: trimmed.slice(0, 200), matchStart: Math.max(0, idx - trimOffset), matchEnd: Math.max(0, idx - trimOffset) + q.length })
            pos = idx + q.length
            if (matches.length > 100) break
          }
        }
        if (matches.length > 0) results.push({ filePath: fullPath, fileName: name, relativePath: relative(rootPath, fullPath).replace(/\\/g, '/'), matches })
      } catch { /* skip */ }
    }
  }
  return results
}

export function registerIpcHandlers(): void {

  ipcMain.handle(IPC.FILE_OPEN, async () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }, { name: 'Texto', extensions: ['txt'] }, { name: 'Todos', extensions: ['*'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return { success: false }
    try { return { success: true, path: filePaths[0], content: await readTextFile(filePaths[0]) } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_OPEN_PATH, async (_e, path: string) => {
    try { return { success: true, path, content: await readTextFile(path) } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_SAVE, async (_e, path: string, content: string) => {
    ignoreNextChange = true
    try { await writeFile(path, content, 'utf-8'); return { success: true, path } }
    catch (e) { ignoreNextChange = false; return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_SAVE_AS, async (_e, content: string) => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Texto', extensions: ['txt'] }],
    })
    if (canceled || !filePath) return { success: false }
    ignoreNextChange = true
    try { await writeFile(filePath, content, 'utf-8'); return { success: true, path: filePath } }
    catch (e) { ignoreNextChange = false; return { success: false, error: String(e) } }
  })

  // ── Salvar imagem em assets ───────────────────────────────────────────
  // payload: { mdFilePath, assetsFolder, fileName, buffer (base64) | sourcePath }
  ipcMain.handle(IPC.IMAGE_SAVE, async (_e, payload: {
    mdFilePath: string
    assetsFolder: string
    fileName: string
    buffer?: string     // base64 — para imagens do clipboard
    sourcePath?: string // path original — para drag & drop de arquivo
  }) => {
    try {
      const mdDir    = dirname(payload.mdFilePath)
      const destDir  = join(mdDir, payload.assetsFolder)
      await mkdir(destDir, { recursive: true })

      // resolve nome único se já existir
      let fileName = payload.fileName
      let destPath = join(destDir, fileName)
      let counter  = 1
      while (true) {
        try { await stat(destPath); } catch { break } // não existe → pode usar
        const ext  = extname(fileName)
        const base = basename(fileName, ext)
        fileName = `${base}-${counter}${ext}`
        destPath = join(destDir, fileName)
        counter++
      }

      if (payload.buffer) {
        // imagem do clipboard (base64)
        const buf = Buffer.from(payload.buffer, 'base64')
        await writeFile(destPath, buf)
      } else if (payload.sourcePath) {
        // drag & drop de arquivo
        await copyFile(payload.sourcePath, destPath)
      } else {
        return { success: false, error: 'Nenhuma fonte de imagem fornecida' }
      }

      const relPath = `./${payload.assetsFolder}/${fileName}`.replace(/\\/g, '/')
      return { success: true, savedPath: destPath, relativePath: relPath }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(IPC.DIR_LIST, async (_e, dirPath: string) => {
    try { return { success: true, entries: await listDir(dirPath), dirPath } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.DIR_OPEN, async () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return { success: false }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (canceled || !filePaths.length) return { success: false }
    try { return { success: true, entries: await listDir(filePaths[0]), dirPath: filePaths[0] } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.SEARCH_FILES, async (_e, dirPath: string, query: string, caseSensitive = false): Promise<SearchResult> => {
    if (!query.trim()) return { success: true, query, results: [], total: 0 }
    try {
      const results = await searchInFiles(dirPath, dirPath, query, caseSensitive)
      return { success: true, query, results, total: results.reduce((s, r) => s + r.matches.length, 0) }
    } catch (e) { return { success: false, query, results: [], total: 0, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_NEW_IN_DIR, async (_e, dirPath: string, fileName: string) => {
    try {
      const name = fileName.endsWith('.md') || fileName.endsWith('.txt') ? fileName : `${fileName}.md`
      const fullPath = join(dirPath, name)
      try { await stat(fullPath); return { success: false, error: 'Arquivo já existe', path: fullPath } }
      catch { /* não existe */ }
      await writeFile(fullPath, '', 'utf-8')
      return { success: true, path: fullPath, content: '' }
    } catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.DIR_NEW, async (_e, parentPath: string, dirName: string) => {
    try {
      const fullPath = join(parentPath, dirName)
      await mkdir(fullPath, { recursive: false })
      return { success: true, path: fullPath }
    } catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_RENAME, async (_e, oldPath: string, newName: string) => {
    try {
      const dir = dirname(oldPath); const oldName = basename(oldPath)
      const oldExt = extname(oldName); const newExt = extname(newName)
      const finalName = (oldExt && !newExt) ? `${newName}${oldExt}` : newName
      const newPath = join(dir, finalName)
      await rename(oldPath, newPath)
      return { success: true, oldPath, newPath, newName: finalName }
    } catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_MOVE, async (_e, sourcePath: string, destDir: string) => {
    try {
      const name    = basename(sourcePath)
      const newPath = join(destDir, name)
      try {
        await stat(newPath)
        return { success: false, error: `"${name}" já existe em "${destDir}"`, newPath }
      } catch { /* não existe — pode mover */ }
      await rename(sourcePath, newPath)
      return { success: true, sourcePath, newPath }
    } catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_DELETE, async (_e, filePath: string) => {
    try { await shell.trashItem(filePath); return { success: true, path: filePath } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_REVEAL, async (_e, filePath: string) => {
    try { shell.showItemInFolder(filePath); return { success: true } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.FILE_COPY_PATH, async (_e, filePath: string) => {
    try { clipboard.writeText(filePath); return { success: true } }
    catch (e) { return { success: false, error: String(e) } }
  })

  ipcMain.handle(IPC.WATCH_START, async (_e, filePath: string) => {
    await startWatch(filePath); return { success: true }
  })
  ipcMain.handle(IPC.WATCH_STOP, async () => {
    await stopWatch(); return { success: true }
  })

  ipcMain.handle(IPC.PREFS_GET, () => prefs)
  ipcMain.handle(IPC.PREFS_SET, (_e, partial: Partial<UserPreferences>) => {
    prefs = { ...prefs, ...partial }; return prefs
  })

  ipcMain.handle(IPC.RECENT_GET, async () => loadRecent())

  ipcMain.handle(IPC.RECENT_ADD, async (_e, filePath: string) => {
    const list = await addRecent(filePath)
    BrowserWindow.getAllWindows()[0]?.webContents.send(NOTIFY.RECENT_CHANGED, list)
    return list
  })

  // ── Window controls ───────────────────────────────────────────────────
  ipcMain.handle(IPC.WIN_MINIMIZE, () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })

  ipcMain.handle(IPC.WIN_MAXIMIZE, () => {
    const win = BrowserWindow.getFocusedWindow(); if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle(IPC.WIN_CLOSE, () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
  })
}
