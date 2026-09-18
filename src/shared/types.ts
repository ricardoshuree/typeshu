// [mcp-local harness] feature: sidebar-file-ops | plano: b136dd71 | 2026-09-17 21:47:04
// Adiciona FILE_NEW_IN_DIR, FILE_RENAME, FILE_DELETE ao IPC
// src/shared/types.ts — tipos compartilhados entre main e renderer

export interface OpenFile {
  path: string; name: string; content: string; isDirty: boolean
}

export interface FileResult {
  success: boolean; path?: string; content?: string; error?: string
}

export interface FileEntry {
  name: string; path: string; isDirectory: boolean; children?: FileEntry[]
}

export interface DirListResult {
  success: boolean; entries?: FileEntry[]; dirPath?: string; error?: string
}

export interface SearchMatch {
  lineNumber: number; lineText: string; matchStart: number; matchEnd: number
}

export interface SearchFileResult {
  filePath: string; fileName: string; relativePath: string; matches: SearchMatch[]
}

export interface SearchResult {
  success: boolean; query: string; results: SearchFileResult[]; total: number; error?: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  fontSize: number; fontFamily: string; lineHeight: number
  focusMode: boolean; typewriterMode: boolean; spellCheck: boolean
  autoPairDelimiters: boolean
  autoSave: boolean
  autoSaveInterval: number
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  fontSize: 16,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  lineHeight: 1.6,
  focusMode: false,
  typewriterMode: false,
  spellCheck: true,
  autoPairDelimiters: true,
  autoSave: true,
  autoSaveInterval: 30,
}

export const IPC = {
  FILE_OPEN:        'file:open',
  FILE_OPEN_PATH:   'file:open-path',
  FILE_SAVE:        'file:save',
  FILE_SAVE_AS:     'file:save-as',
  FILE_NEW:         'file:new',
  FILE_NEW_IN_DIR:  'file:new-in-dir',   // cria arquivo em pasta específica
  FILE_RENAME:      'file:rename',        // renomeia arquivo/pasta
  FILE_DELETE:      'file:delete',        // move para lixeira
  DIR_LIST:         'dir:list',
  DIR_OPEN:         'dir:open',
  SEARCH_FILES:     'search:files',
  WATCH_START:      'watch:start',
  WATCH_STOP:       'watch:stop',
  PREFS_GET:        'prefs:get',
  PREFS_SET:        'prefs:set',
} as const

export const NOTIFY = {
  FILE_CHANGED_EXTERNALLY: 'notify:file-changed',
} as const
