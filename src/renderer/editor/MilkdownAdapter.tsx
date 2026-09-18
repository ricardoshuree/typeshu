// [mcp-local harness] feature: list-toggle-fix2 | plano: 3310a28e | 2026-09-18
// Fix definitivo toggle lista: closure booleana coordena lift XOR callCommand
import React, { useRef, useImperativeHandle, forwardRef } from 'react'
import {
  Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx,
  editorViewCtx, type Ctx,
} from '@milkdown/core'
import {
  commonmark,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/preset-commonmark'
import { gfm, insertTableCommand } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { math } from '@milkdown/plugin-math'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { callCommand, $prose } from '@milkdown/utils'
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { liftListItem } from 'prosemirror-schema-list'
import type { EditorView } from 'prosemirror-view'
import { createAutoPairPlugin }    from './autoPairPlugin'
import { createTaskListPlugin }    from './taskListPlugin'
import { createFrontMatterPlugin } from './frontMatterPlugin'
import { createMermaidPlugin }     from './mermaidPlugin'
import { createShortcutPlugin }    from './shortcutPlugin'
import { createFindPlugin, findPluginKey } from './findPlugin'
import { SIDEBAR_DRAG_KEY } from '../components/Sidebar'
import type { EditorProps } from './EditorAdapter'
import 'katex/dist/katex.min.css'

export interface EditorHandle {
  executeWithSelection: (savedFrom: number, savedTo: number, fn: () => void) => void
  focusEditor:          () => void
  toggleBold:           () => void
  toggleItalic:         () => void
  toggleStrikethrough:  () => void
  toggleBlockquote:     () => void
  toggleBulletList:     () => void
  toggleOrderedList:    () => void
  setHeading:           (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void
  insertCodeFence:      (lang?: string) => void
  insertTable:          () => void
  getSelectedText:      () => string
  replaceSelectionWith: (text: string) => void
  find:                 (query: string, caseSensitive?: boolean) => void
  findNext:             () => void
  findPrev:             () => void
  clearFind:            () => void
  getFindState:         () => { matches: number; current: number }
  scrollToCurrentMatch: () => void
  replaceOne:           (replacement: string) => void
  replaceAll:           (replacement: string) => void
}

interface MilkdownEditorProps extends EditorProps {
  onKeyDown?:       (e: KeyboardEvent) => void
  onFindState?:     (matches: number, current: number) => void
  currentFilePath?: string | null
}

function getView(ctx: Ctx) {
  try { return ctx.get(editorViewCtx) } catch { return null }
}

function toggleMark(markName: string, ctx: Ctx) {
  try {
    const view = getView(ctx); if (!view) return
    const { state, dispatch } = view
    const mark = state.schema.marks[markName]; if (!mark) return
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
  } catch (e) { console.warn(`toggle ${markName} error:`, e) }
}

function doInsertCodeFence(ctx: Ctx, lang = '') {
  try {
    const view = getView(ctx); if (!view) return
    const { state, dispatch } = view
    const nodeType = state.schema.nodes['code_block'] ?? state.schema.nodes['fence'] ?? null
    if (!nodeType) return
    const { $from } = state.selection
    if ($from.parent.type === nodeType) return
    const insertPos = $from.after()
    const node = nodeType.create({ language: lang })
    const tr = state.tr.insert(insertPos, node)
    try { tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)) } catch {}
    dispatch(tr.scrollIntoView())
    view.focus()
  } catch (e) { console.warn('insertCodeFence error:', e) }
}

// ── Helpers de lista ──────────────────────────────────────────────────────
function isInListType(view: EditorView, listTypeName: string): boolean {
  const listType = view.state.schema.nodes[listTypeName]
  if (!listType) return false
  const { $from } = view.state.selection
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type === listType) return true
  }
  return false
}

// ── Drop plugin (C: sidebar → editor) ─────────────────────────────────────
function relativePath(from: string, to: string): string {
  const norm = (p: string) => p.replace(/\\/g, '/')
  const fromDir = norm(from).replace(/\/[^/]+$/, '')
  const toNorm  = norm(to)
  if (toNorm.startsWith(fromDir + '/')) return './' + toNorm.slice(fromDir.length + 1)
  const fromParts = fromDir.split('/')
  const toParts   = toNorm.split('/')
  let common = 0
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common++
  const ups  = fromParts.length - common
  const down = toParts.slice(common)
  return (ups > 0 ? '../'.repeat(ups) : './') + down.join('/')
}

function pathBasename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

const dropPluginKey = new PluginKey('sidebarDrop')

function createDropPlugin(getCurrentFilePath: () => string | null | undefined): Plugin {
  return new Plugin({
    key: dropPluginKey,
    props: {
      handleDrop(view: EditorView, event: DragEvent): boolean {
        const filePath = event.dataTransfer?.getData(SIDEBAR_DRAG_KEY)
        if (!filePath) return false
        event.preventDefault()
        const isDir  = event.dataTransfer?.getData('typeshu/isdir') === '1'
        const name   = pathBasename(filePath)
        const label  = isDir ? name : name.replace(/\.(md|markdown|txt)$/i, '')
        const currentFile = getCurrentFilePath()
        let href: string
        if (currentFile) {
          href = relativePath(currentFile, filePath) + (isDir ? '/' : '')
        } else {
          href = isDir ? `./${name}/` : `./${name}`
        }
        const mdLink = `[${label}](${href})`
        const coords = { left: event.clientX, top: event.clientY }
        const pos = view.posAtCoords(coords)
        if (!pos) { view.dispatch(view.state.tr.insertText(mdLink)); view.focus(); return true }
        view.dispatch(view.state.tr.insertText(mdLink, pos.pos).scrollIntoView())
        view.focus()
        return true
      },
    },
  })
}

const MilkdownEditor = forwardRef<EditorHandle, MilkdownEditorProps>(function MilkdownEditor(
  { initialContent = '', onChange, readOnly = false, onKeyDown, onFindState, currentFilePath },
  ref
) {
  const onChangeRef       = useRef(onChange)
  const onKeyDownRef      = useRef(onKeyDown)
  const onFindStateRef    = useRef(onFindState)
  const currentFileRef    = useRef(currentFilePath)
  onChangeRef.current     = onChange
  onKeyDownRef.current    = onKeyDown
  onFindStateRef.current  = onFindState
  currentFileRef.current  = currentFilePath

  const autoPairSlice    = useRef($prose(() => createAutoPairPlugin()))
  const taskListSlice    = useRef($prose(() => createTaskListPlugin()))
  const frontMatterSlice = useRef($prose(() => createFrontMatterPlugin()))
  const mermaidSlice     = useRef($prose(() => createMermaidPlugin()))
  const shortcutSlice    = useRef($prose(() => createShortcutPlugin()))
  const findSlice        = useRef($prose(() => createFindPlugin()))
  const dropSlice        = useRef($prose(() => createDropPlugin(() => currentFileRef.current)))

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialContent)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnly,
          attributes: { class: 'editor', 'data-placeholder': 'Comece a digitar...' },
          handleDOMEvents: {
            keydown: (_view, event) => {
              if (event.key === 'F8' || event.key === 'F9') {
                onKeyDownRef.current?.(event); event.preventDefault(); return true
              }
              return false
            },
          },
        }))
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current?.(markdown)
        })
      })
      .use(commonmark).use(gfm).use(history).use(listener).use(math)
      .use(shortcutSlice.current)
      .use(findSlice.current)
      .use(autoPairSlice.current)
      .use(taskListSlice.current)
      .use(frontMatterSlice.current)
      .use(mermaidSlice.current)
      .use(dropSlice.current)
  )

  function dispatchAndNotify(view: any, tr: any) {
    view.dispatch(tr)
    const s = findPluginKey.getState(view.state)
    if (s) onFindStateRef.current?.(s.matches.length, s.current)
  }

  useImperativeHandle(ref, () => ({
    executeWithSelection: (savedFrom: number, savedTo: number, fn: () => void) => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        try {
          const sel = TextSelection.create(view.state.doc, savedFrom, savedTo)
          view.dispatch(view.state.tr.setSelection(sel))
          view.focus()
        } catch { view.focus() }
      })
      fn()
    },

    focusEditor: () => {
      const e = get(); if (!e) return
      e.action((ctx) => { const view = getView(ctx); if (view) view.focus() })
    },

    toggleBold:          () => { const e = get(); if (e) e.action(ctx => toggleMark('strong', ctx)) },
    toggleItalic:        () => { const e = get(); if (e) e.action(ctx => toggleMark('emphasis', ctx)) },
    toggleStrikethrough: () => { const e = get(); if (e) e.action(ctx => toggleMark('strike_through', ctx)) },

    toggleBlockquote: () => {
      const e = get(); if (!e) return
      e.action((ctx) => { const view = getView(ctx); if (view && !view.hasFocus()) view.focus() })
      e.action(callCommand(wrapInBlockquoteCommand.key))
    },

    // ── Toggle lista — padrão: closure booleana coordena duas actions ──────
    toggleBulletList: () => {
      const e = get(); if (!e) return
      // Passo 1: captura o estado atual e executa lift se necessário
      let wasInList = false
      e.action((ctx) => {
        const view = getView(ctx); if (!view) return
        if (!view.hasFocus()) view.focus()
        wasInList = isInListType(view, 'bullet_list')
        if (wasInList) {
          const itemType = view.state.schema.nodes['list_item']
          if (itemType) {
            liftListItem(itemType)(view.state, view.dispatch)
            view.focus()
          }
        }
      })
      // Passo 2: wrap — só tem efeito se não estava na lista (callCommand é no-op se inaplicável)
      if (!wasInList) {
        e.action(callCommand(wrapInBulletListCommand.key))
      }
    },

    toggleOrderedList: () => {
      const e = get(); if (!e) return
      let wasInList = false
      e.action((ctx) => {
        const view = getView(ctx); if (!view) return
        if (!view.hasFocus()) view.focus()
        wasInList = isInListType(view, 'ordered_list')
        if (wasInList) {
          const itemType = view.state.schema.nodes['list_item']
          if (itemType) {
            liftListItem(itemType)(view.state, view.dispatch)
            view.focus()
          }
        }
      })
      if (!wasInList) {
        e.action(callCommand(wrapInOrderedListCommand.key))
      }
    },

    insertTable: () => {
      const e = get(); if (!e) return
      e.action((ctx) => { const view = getView(ctx); if (view && !view.hasFocus()) view.focus() })
      e.action(callCommand(insertTableCommand.key))
    },
    setHeading: (level: 0|1|2|3|4|5|6) => {
      const e = get(); if (!e) return
      e.action((ctx) => { const view = getView(ctx); if (view && !view.hasFocus()) view.focus() })
      e.action(callCommand(wrapInHeadingCommand.key, level))
    },

    insertCodeFence: (lang = '') => { const e = get(); if (e) e.action(ctx => doInsertCodeFence(ctx, lang)) },

    getSelectedText: () => {
      const editor = get(); if (!editor) return ''
      let sel = ''
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        try { sel = view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, '\n') } catch {}
      })
      return sel
    },

    replaceSelectionWith: (text: string) => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        try { view.dispatch(view.state.tr.insertText(text).scrollIntoView()); view.focus() }
        catch (e) { console.warn('replaceSelectionWith error:', e) }
      })
    },

    find: (query: string, caseSensitive = false) => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        dispatchAndNotify(view, view.state.tr.setMeta(findPluginKey, { type: 'find', query, caseSensitive }))
      })
    },
    findNext: () => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        dispatchAndNotify(view, view.state.tr.setMeta(findPluginKey, { type: 'next' }))
      })
    },
    findPrev: () => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        dispatchAndNotify(view, view.state.tr.setMeta(findPluginKey, { type: 'prev' }))
      })
    },
    clearFind: () => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        dispatchAndNotify(view, view.state.tr.setMeta(findPluginKey, { type: 'clear' }))
      })
    },
    getFindState: () => {
      const editor = get(); if (!editor) return { matches: 0, current: -1 }
      let result = { matches: 0, current: -1 }
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        const s = findPluginKey.getState(view.state)
        if (s) result = { matches: s.matches.length, current: s.current }
      })
      return result
    },
    scrollToCurrentMatch: () => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        const s = findPluginKey.getState(view.state); if (!s || s.current < 0 || !s.matches.length) return
        const match = s.matches[s.current]
        try {
          view.dispatch(view.state.tr
            .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
            .scrollIntoView()
          )
        } catch {}
      })
    },
    replaceOne: (replacement: string) => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        const s = findPluginKey.getState(view.state)
        if (!s || s.current < 0 || !s.matches.length) return
        const match = s.matches[s.current]
        const tr = view.state.tr
          .insertText(replacement, match.from, match.to)
          .setMeta(findPluginKey, { type: 'find', query: s.query, caseSensitive: s.caseSensitive })
        view.dispatch(tr)
        const s2 = findPluginKey.getState(view.state)
        if (s2 && s2.matches.length > 0) {
          dispatchAndNotify(view, view.state.tr.setMeta(findPluginKey, { type: 'next' }))
        } else {
          onFindStateRef.current?.(s2?.matches.length ?? 0, s2?.current ?? -1)
        }
        view.focus()
      })
    },
    replaceAll: (replacement: string) => {
      const editor = get(); if (!editor) return
      editor.action((ctx) => {
        const view = getView(ctx); if (!view) return
        const s = findPluginKey.getState(view.state)
        if (!s || !s.matches.length) return
        let tr = view.state.tr
        const matches = [...s.matches].reverse()
        for (const match of matches) tr = tr.insertText(replacement, match.from, match.to)
        tr = tr.setMeta(findPluginKey, { type: 'clear' })
        view.dispatch(tr)
        onFindStateRef.current?.(0, -1)
        view.focus()
      })
    },
  }), [get])

  return <Milkdown />
})

export interface MilkdownAdapterProps extends EditorProps {
  editorRef?:       React.Ref<EditorHandle>
  onKeyDown?:       (e: KeyboardEvent) => void
  onFindState?:     (matches: number, current: number) => void
  currentFilePath?: string | null
}

export function MilkdownAdapter({ editorRef, ...props }: MilkdownAdapterProps): React.JSX.Element {
  return (
    <MilkdownProvider>
      <MilkdownEditor ref={editorRef} {...props} />
    </MilkdownProvider>
  )
}
