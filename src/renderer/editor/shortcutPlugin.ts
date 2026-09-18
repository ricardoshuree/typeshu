// [mcp-local harness] feature: cleanup-shortcuts | plano: 518fdbd9 | 2026-09-17 21:38:44
// shortcutPlugin limpo, sem logs de debug
/**
 * shortcutPlugin.ts
 *
 * Plugin ProseMirror para atalhos que precisam rodar antes do autoPair:
 *
 *   Ctrl+Shift+K  → insere code_block após o parágrafo atual
 *   Alt+Shift+5   → toggle strikethrough
 *
 * Registrado como $prose slice no MilkdownAdapter, antes do autoPairPlugin.
 *
 * Notas de compatibilidade Windows / teclado Logi:
 *   Alt+Shift+5 pode gerar key='Clear' (Numpad5 com NumLock) ou key='5'/'%'
 *   Ctrl+Shift+K gera key='K' (maiúsculo) — normalizado com toLowerCase()
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

const shortcutKey = new PluginKey('editorShortcuts')

function isStrikethrough(e: KeyboardEvent): boolean {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return false
  return (
    e.key === '5'        ||
    e.key === '%'        ||
    e.key === 'Clear'    ||
    e.code === 'Digit5'  ||
    e.code === 'Numpad5'
  )
}

function isCodeFence(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return false
  return e.key.toLowerCase() === 'k'
}

function toggleStrikethrough(view: EditorView): boolean {
  const { state, dispatch } = view
  const mark = state.schema.marks['strike_through']
  if (!mark) return false
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

  const nodeType =
    state.schema.nodes['code_block'] ??
    state.schema.nodes['fence']      ??
    state.schema.nodes['code']       ??
    null

  if (!nodeType) return false

  const { $from } = state.selection
  if ($from.parent.type === nodeType) return false

  // Insere o code_block logo após o nó atual (parágrafo, heading, etc.)
  const insertPos = $from.after()
  const node = nodeType.create({ language: '' })
  const tr = state.tr.insert(insertPos, node)

  // Posiciona cursor dentro do bloco
  try {
    tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
  } catch {}

  dispatch(tr.scrollIntoView())
  view.focus()
  return true
}

export function createShortcutPlugin(): Plugin {
  return new Plugin({
    key: shortcutKey,
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (isStrikethrough(event)) {
          event.preventDefault()
          return toggleStrikethrough(view)
        }
        if (isCodeFence(event)) {
          event.preventDefault()
          return insertCodeBlock(view)
        }
        return false
      },
    },
  })
}
