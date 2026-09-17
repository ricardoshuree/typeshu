// [mcp-local harness] feature: auto-pair-delimiters | plano: 1bbb5ef2 | 2026-09-17 13:56:42
// Plugin ProseMirror de auto-pair de delimitadores
/**
 * autoPairPlugin.ts
 *
 * Plugin ProseMirror que implementa auto-pair de delimitadores ao estilo Typora:
 *
 *  - Tecla de abertura  → insere par e posiciona cursor entre eles
 *  - Com texto selecionado → envolve a seleção com o par
 *  - Tecla de fechamento com cursor já antes do fechante → skip (não duplica)
 *  - Backspace entre par vazio → apaga os dois caracteres
 *
 * Pares cobertos:
 *   (  )   [  ]   {  }   "  "   '  '   `  `   *  *   _  _
 *
 * Nota: * e _ usam o mesmo char para abrir e fechar.
 * Para ' (apóstrofo), o pair só é inserido se o caractere anterior não for
 * uma letra/dígito, evitando interferir em contrações como "don't".
 */

import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

// Mapa de abertura → fechamento
const PAIRS: Record<string, string> = {
  '(':  ')',
  '[':  ']',
  '{':  '}',
  '"':  '"',
  "'":  "'",
  '`':  '`',
  '*':  '*',
  '_':  '_',
}

// Chars que são simultaneamente abridor e fechador (toggle)
const SYMMETRIC = new Set(["'", '"', '`', '*', '_'])

// Chars de fechamento que podem ser "skipados"
const CLOSERS = new Set([')', ']', '}', '"', "'", '`', '*', '_'])

const autoPairKey = new PluginKey('autoPair')

/**
 * Retorna o texto de um nó de texto na posição do cursor,
 * e a posição dentro desse texto.
 */
function getTextContext(state: EditorState): { before: string; after: string } {
  const { $from } = state.selection
  const node = $from.parent
  if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
    // Dentro de code block etc., não fazemos auto-pair
    return { before: '', after: '' }
  }
  const offset = $from.parentOffset
  const text = node.textContent
  return {
    before: text.slice(0, offset),
    after:  text.slice(offset),
  }
}

/**
 * Verifica se o nó atual é um bloco de código (code_block / fence).
 * Não fazemos auto-pair dentro de blocos de código.
 */
function isInCodeBlock(state: EditorState): boolean {
  const { $from } = state.selection
  const name = $from.parent.type.name
  return name === 'code_block' || name === 'fence' || name === 'code'
}

export function createAutoPairPlugin(): Plugin {
  return new Plugin({
    key: autoPairKey,

    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const key = event.key

        // ── Ignorar dentro de code blocks ────────────────────────────
        if (isInCodeBlock(view.state)) return false

        const state   = view.state
        const { selection } = state
        const { from, to, empty } = selection

        // ── Backspace: apagar par vazio ───────────────────────────────
        if (key === 'Backspace' && empty) {
          const { before, after } = getTextContext(state)
          const lastChar  = before.slice(-1)
          const firstChar = after.slice(0, 1)
          if (lastChar && PAIRS[lastChar] === firstChar && PAIRS[lastChar] !== undefined) {
            // Cursor está entre abertura e fechamento: apaga os dois
            const tr = state.tr.delete(from - 1, from + 1)
            view.dispatch(tr)
            return true
          }
          return false
        }

        // ── Skip do fechante ──────────────────────────────────────────
        if (CLOSERS.has(key) && empty) {
          const { after } = getTextContext(state)
          const nextChar = after.slice(0, 1)
          if (nextChar === key) {
            // Apenas avança o cursor
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, from + 1)
            )
            view.dispatch(tr)
            event.preventDefault()
            return true
          }
        }

        // ── Abertura de par ───────────────────────────────────────────
        if (!Object.prototype.hasOwnProperty.call(PAIRS, key)) return false

        const closer = PAIRS[key]

        // Para apóstrofo: não pair se caractere anterior for letra/dígito
        // (contrações: "don't", "it's")
        if (key === "'") {
          if (empty) {
            const { before } = getTextContext(state)
            const prev = before.slice(-1)
            if (prev && /[\w\d]/.test(prev)) return false
          }
        }

        // Para * e _ simétricos: se o próximo char já é o mesmo, skip
        if (SYMMETRIC.has(key) && empty) {
          const { after } = getTextContext(state)
          if (after.slice(0, 1) === key) {
            // skip — deixar ProseMirror fazer o default
            return false
          }
        }

        event.preventDefault()

        let tr: Transaction

        if (!empty) {
          // ── Com seleção: envolve o texto selecionado ─────────────
          const selectedText = state.doc.textBetween(from, to)
          tr = state.tr
            .insertText(key + selectedText + closer, from, to)
          // Posiciona cursor após o texto envolvido (antes do fechante)
          tr = tr.setSelection(
            TextSelection.create(tr.doc, from + 1, from + 1 + selectedText.length)
          )
        } else {
          // ── Sem seleção: insere par e posiciona entre eles ────────
          tr = state.tr.insertText(key + closer, from)
          tr = tr.setSelection(
            TextSelection.create(tr.doc, from + 1)
          )
        }

        view.dispatch(tr)
        return true
      },
    },
  })
}
