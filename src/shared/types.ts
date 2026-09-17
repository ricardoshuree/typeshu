// [mcp-local harness] feature: global-search | plano: f149f65d | 2026-09-17 15:32:04
// Adiciona SearchMatch, SearchFileResult, SearchResult e IPC.SEARCH_FILES aos tipos compartilhados
// src/shared/types.ts
// Tipos compartilhados entre main e renderer

export interface OpenFile {
  path: string
  name: string
  content: string
  isDirty: boolean
}

export interface FileResult {
  success: boolean
  path?: string
  content?: string
  error?: string
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

export interface DirListResult {
  success: boolean
  entries?: FileEntry[]
  dirPath?: string
  error?: string
}

export interface SearchMatch {
  lineNumber:  number    // 1-based
  lineText:    string    // texto da linha (trimmed)
  matchStart:  number    // posição do match dentro de lineText
  matchEnd:    number
}

export interface SearchFileResult {
  filePath:     string
  fileName:     string
  relativePath: string
  matches:      SearchMatch[]
}

export interface SearchResult {
  success:  boolean
  query:    string
  results:  SearchFileResult[]
  total:    number           // total de matches em todos os arquivos
  error?:   string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  fontSize: number
  fontFamily: string
  lineHeight: number
  focusMode: boolean
  typewriterMode: boolean
  spellCheck: boolean
  autoPairDelimiters: boolean
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
}

export const IPC = {
  FILE_OPEN:      'file:open',
  FILE_OPEN_PATH: 'file:open-path',
  FILE_SAVE:      'file:save',
  FILE_SAVE_AS:   'file:save-as',
  FILE_NEW:       'file:new',
  DIR_LIST:       'dir:list',
  DIR_OPEN:       'dir:open',
  SEARCH_FILES:   'search:files',    // busca de texto em arquivos
  PREFS_GET:      'prefs:get',
  PREFS_SET:      'prefs:set',
} as const
