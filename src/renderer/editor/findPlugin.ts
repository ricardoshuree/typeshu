// [mcp-local harness] feature: find-cleanup | plano: 9d31e5f9 | 2026-09-17 22:09:21
// findPlugin limpo sem logs de debug
/**
 * findPlugin.ts
 *
 * Plugin ProseMirror para busca inline no documento.
 * Usa DecorationSet para highlight sem modificar o conteúdo.
 *
 * Controlado via transactions com meta:
 *   tr.setMeta(findPluginKey, { type: 'find', query, caseSensitive? })
 *   tr.setMeta(findPluginKey, { type: 'next' })
 *   tr.setMeta(findPluginKey, { type: 'prev' })
 *   tr.setMeta(findPluginKey, { type: 'clear' })
 */

import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { Node as ProseMirrorNode } from 'prosemirror-model'

export const findPluginKey = new PluginKey<FindPluginState>('findInDocument')

export interface FindMatch { from: number; to: number }

export interface FindPluginState {
  query:         string
  caseSensitive: boolean
  matches:       FindMatch[]
  current:       number
  decorations:   DecorationSet
}

function findAllMatches(doc: ProseMirrorNode, query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return []
  const matches: FindMatch[] = []
  const q = caseSensitive ? query : query.toLowerCase()

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = caseSensitive ? node.text : node.text.toLowerCase()
    let start = 0
    while (start < text.length) {
      const idx = text.indexOf(q, start)
      if (idx < 0) break
      matches.push({ from: pos + idx, to: pos + idx + q.length })
      start = idx + q.length
    }
  })

  return matches
}

function buildDecorations(doc: ProseMirrorNode, matches: FindMatch[], current: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty
  const decos = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === current ? 'find-match find-match--current' : 'find-match',
    })
  )
  return DecorationSet.create(doc, decos)
}

const initialState: FindPluginState = {
  query: '', caseSensitive: false, matches: [], current: -1, decorations: DecorationSet.empty,
}

export function createFindPlugin(): Plugin<FindPluginState> {
  return new Plugin<FindPluginState>({
    key: findPluginKey,

    state: {
      init(): FindPluginState { return initialState },

      apply(tr: Transaction, prev: FindPluginState, _oldState: EditorState, newState: EditorState): FindPluginState {
        const meta = tr.getMeta(findPluginKey) as
          | { type: 'find'; query: string; caseSensitive?: boolean }
          | { type: 'next' | 'prev' | 'clear' }
          | undefined

        if (meta?.type === 'clear') return initialState

        if (meta?.type === 'find') {
          const { query, caseSensitive = false } = meta
          if (!query) return { ...initialState }
          const matches = findAllMatches(newState.doc, query, caseSensitive)
          const current = matches.length > 0 ? 0 : -1
          return {
            query, caseSensitive, matches, current,
            decorations: buildDecorations(newState.doc, matches, current),
          }
        }

        if ((meta?.type === 'next' || meta?.type === 'prev') && prev.matches.length > 0) {
          const len     = prev.matches.length
          const current = meta.type === 'next'
            ? (prev.current + 1) % len
            : (prev.current - 1 + len) % len
          return {
            ...prev, current,
            decorations: buildDecorations(newState.doc, prev.matches, current),
          }
        }

        if (tr.docChanged && prev.query) {
          const matches = findAllMatches(newState.doc, prev.query, prev.caseSensitive)
          const current = Math.min(prev.current, matches.length - 1)
          return {
            ...prev, matches, current: matches.length > 0 ? Math.max(0, current) : -1,
            decorations: buildDecorations(newState.doc, matches, current),
          }
        }

        return prev
      },
    },

    props: {
      decorations(state: EditorState) {
        return findPluginKey.getState(state)?.decorations ?? DecorationSet.empty
      },
    },
  })
}
