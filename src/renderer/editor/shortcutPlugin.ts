// [mcp-local harness] feature: replace-in-document | plano: 25f77ea9 | 2026-09-17 22:11:33
// shortcutPlugin: adiciona Ctrl+H para abrir replace via setReplaceOpener
/**
 * shortcutPlugin.ts
 *
 * Plugin ProseMirror para atalhos antes do autoPair:
 *   Ctrl+Shift+K → code_block
 *   Alt+Shift+5  → strikethrough
 *   Ctrl+F       → abre FindBar (modo find)
 *   Ctrl+H       → abre FindBar (modo replace)
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

const shortcutKey = new PluginKey('editorShortcuts')

let onOpenFind:    (() => void) | null = null
let onOpenReplace: (() => void) | null = null

export function setFindOpener(fn: () => void)    { onOpenFind    = fn }
export function setReplaceOpener(fn: () => void) { onOpenReplace = fn }

function isStrikethrough(e: KeyboardEvent): boolean {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return false
  return e.key === '5' || e.key === '%' || e.key === 'Clear' || e.code === 'Digit5' || e.code === 'Numpad5'
}

function isCodeFence(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return false
  return e.key.toLowerCase() === 'k'
}

function isFind(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return false
  return e.key.toLowerCase() === 'f'
}

function isReplace(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return false
  return e.key.toLowerCase() === 'h'
}

function toggleStrikethrough(view: EditorView): boolean {
  const { state, dispatch } = view
  const mark = state.schema.marks['strike_through']; if (!mark) return false
  const { from, to, empty } = state.selection
  if (empty) {
    const stored = state.storedMarks ?? []
    const has = stored.some((m: any) => m.type === mark)
    dispatch(has ? state.tr.removeStoredMark(mark) : state.tr.addStoredMark(mark.create()))
  } else {
    const has = state.doc.rangeHasMark(from, to, mark)
    dispatch(has
      ? state.tr.removeMark(from, to, mark).scrollIntoView()
      : state.tr.addMark(from, to, mark.create()).scrollIntoView()
    )
  }
  view.focus()
  return true
}

function insertCodeBlock(view: EditorView): boolean {
  const { state, dispatch } = view
  const nodeType = state.schema.nodes['code_block'] ?? state.schema.nodes['fence'] ?? state.schema.nodes['code'] ?? null
  if (!nodeType) return false
  const { $from } = state.selection
  if ($from.parent.type === nodeType) return false
  const insertPos = $from.after()
  const node = nodeType.create({ language: '' })
  const tr = state.tr.insert(insertPos, node)
  try { tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)) } catch {}
  dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

export function createShortcutPlugin(): Plugin {
  return new Plugin({
    key: shortcutKey,
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (isStrikethrough(event)) { event.preventDefault(); return toggleStrikethrough(view) }
        if (isCodeFence(event))     { event.preventDefault(); return insertCodeBlock(view) }
        if (isFind(event))    { event.preventDefault(); onOpenFind?.();    return true }
        if (isReplace(event)) { event.preventDefault(); onOpenReplace?.(); return true }
        return false
      },
    },
  })
}
