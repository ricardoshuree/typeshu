// [mcp-local harness] feature: custom-titlebar | plano: e4a3096f | 2026-09-18
// +WIN_MINIMIZE/MAXIMIZE/CLOSE/IS_MAXIMIZED ao IPC
export interface OpenFile {
  path: string; name: string; content: string; isDirty: boolean
}

export interface FileResult {
  success: boolean; path?: string; content?: string; error?: string
}

export interface FileEntry {
  name: string; path: string; isDirectory: boolean
  mtime?: number
  children?: FileEntry[]
}

export interface RecentFile {
  path: string; name: string
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
  fontSize:           number
  fontFamily:         string
  lineHeight:         number
  autoSave:           boolean
  autoSaveInterval:   number
  autoPairDelimiters: boolean
  spellCheck:         boolean
  focusMode:          boolean
  typewriterMode:     boolean
  mdSubscript:        boolean
  mdSuperscript:      boolean
  mdHighlight:        boolean
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
  FILE_MOVE:        'file:move',
  FILE_DELETE:      'file:delete',
  FILE_REVEAL:      'file:reveal',
  FILE_COPY_PATH:   'file:copy-path',
  DIR_LIST:         'dir:list',
  DIR_OPEN:         'dir:open',
  DIR_NEW:          'dir:new',
  SEARCH_FILES:     'search:files',
  WATCH_START:      'watch:start',
  WATCH_STOP:       'watch:stop',
  PREFS_GET:        'prefs:get',
  PREFS_SET:        'prefs:set',
  RECENT_GET:       'recent:get',
  RECENT_ADD:       'recent:add',
  // Window controls
  WIN_MINIMIZE:     'win:minimize',
  WIN_MAXIMIZE:     'win:maximize',
  WIN_CLOSE:        'win:close',
  WIN_IS_MAXIMIZED: 'win:is-maximized',
} as const

export const NOTIFY = {
  FILE_CHANGED_EXTERNALLY: 'notify:file-changed',
  RECENT_CHANGED:          'notify:recent-changed',
  WIN_MAXIMIZED_CHANGED:   'notify:win-maximized-changed',
} as const
