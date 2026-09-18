// [mcp-local harness] feature: preferences-panel | plano: 88f6fdf3 | 2026-09-17 22:18:41
// UserPreferences com mdSubscript, mdSuperscript, mdHighlight e fontFamily simplificado
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
  // Tema
  theme: 'light' | 'dark' | 'system'
  // Editor
  fontSize:       number
  fontFamily:     string
  lineHeight:     number
  // Comportamento
  autoSave:           boolean
  autoSaveInterval:   number   // segundos
  autoPairDelimiters: boolean
  spellCheck:         boolean
  // Modos (estado persistido)
  focusMode:      boolean
  typewriterMode: boolean
  // Extensões Markdown
  mdSubscript:    boolean   // H~2~O
  mdSuperscript:  boolean   // E=mc^2^
  mdHighlight:    boolean   // ==texto==
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme:              'system',
  fontSize:           16,
  fontFamily:         'Georgia',
  lineHeight:         1.6,
  autoSave:           true,
  autoSaveInterval:   30,
  autoPairDelimiters: true,
  spellCheck:         true,
  focusMode:          false,
  typewriterMode:     false,
  mdSubscript:        false,
  mdSuperscript:      false,
  mdHighlight:        false,
}

export const IPC = {
  FILE_OPEN:        'file:open',
  FILE_OPEN_PATH:   'file:open-path',
  FILE_SAVE:        'file:save',
  FILE_SAVE_AS:     'file:save-as',
  FILE_NEW:         'file:new',
  FILE_NEW_IN_DIR:  'file:new-in-dir',
  FILE_RENAME:      'file:rename',
  FILE_DELETE:      'file:delete',
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
