// [mcp-local harness] feature: sidebar-filetree | plano: de4bef30 | 2026-09-17 13:40:06
// Adicionar FileEntry, DirListResult e IPC.DIR_LIST/DIR_OPEN aos tipos compartilhados
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
  PREFS_GET:      'prefs:get',
  PREFS_SET:      'prefs:set',
} as const
