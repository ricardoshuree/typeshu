// [mcp-local harness] feature: fix-find-editorview | plano: 32024d9b | 2026-09-17 22:08:19
// Fix getView: usa editorViewCtx do Milkdown v7 em vez de rootCtx.editorView
// MilkdownAdapter — fix getEditorView: usa editorViewCtx do Milkdown v7
import React, { useRef, useImperativeHandle, forwardRef } from 'react'
import {
  Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx,
  type Ctx,
} from '@milkdown/core'
import { commonmark, wrapInHeadingCommand } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { math } from '@milkdown/plugin-math'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { callCommand, $prose } from '@milkdown/utils'
import { createAutoPairPlugin }    from './autoPairPlugin'
import { createTaskListPlugin }    from './taskListPlugin'
import { createFrontMatterPlugin } from './frontMatterPlugin'
import { createMermaidPlugin }     from './mermaidPlugin'
import { createShortcutPlugin }    from './shortcutPlugin'
import { createFindPlugin, findPluginKey } from './findPlugin'
import type { EditorProps } from './EditorAdapter'
import 'katex/dist/katex.min.css'

// Importa editorViewCtx do Milkdown v7 — é aqui que fica o EditorView do ProseMirror
import { editorViewCtx } from '@milkdown/core'

export interface EditorHandle {
  toggleBold:          () => void
  toggleItalic:        () => void
  toggleStrikethrough: () => void
  setHeading:          (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void
  insertCodeFence:     (lang?: string) => void
  getSelectedText:     () => string
  replaceSelectionWith:(text: string) => void
  find:                (query: string, caseSensitive?: boolean) => void
  findNext:            () => void
  findPrev:            () => void
  clearFind:           () => void
  getFindState:        () => { matches: number; current: number }
  scrollToCurrentMatch:() => void
}

interface MilkdownEditorProps extends EditorProps {
  onKeyDown?:   (e: KeyboardEvent) => void
  onFindState?: (matches: number, current: number) => void
}

// Pega o EditorView via editorViewCtx (correto no Milkdown v7)
function getView(ctx: Ctx) {
  try { return ctx.get(editorViewCtx) } catch { return null }
}

function toggleMark(markName: string, ctx: Ctx) {
  try {
    const view = getView(ctx)
    if (!view) return
    const { state, dispatch } = view
    const mark = state.schema.marks[markName]
    if (!mark) return
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
    const view = getView(ctx)
    if (!view) return
    const { state, dispatch } = view
    const nodeType = state.schema.nodes['code_block'] ?? state.schema.nodes['fence'] ?? null
    if (!nodeType) return
    const { $from } = state.selection
    if ($from.parent.type === nodeType) return
    const { TextSelection } = require('prosemirror-state')
    const insertPos = $from.after()
    const node = nodeType.create({ language: lang })
    const tr = state.tr.insert(insertPos, node)
    try { tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)) } catch {}
    dispatch(tr.scrollIntoView())
    view.focus()
  } catch (e) { console.warn('insertCodeFence error:', e) }
}

const MilkdownEditor = forwardRef<EditorHandle, MilkdownEditorProps>(function MilkdownEditor(
  { initialContent = '', onChange, readOnly = false, onKeyDown, onFindState },
  ref
) {
  const onChangeRef    = useRef(onChange)
  const onKeyDownRef   = useRef(onKeyDown)
  const onFindStateRef = useRef(onFindState)
  onChangeRef.current    = onChange
  onKeyDownRef.current   = onKeyDown
  onFindStateRef.current = onFindState

  const autoPairSlice    = useRef($prose(() => createAutoPairPlugin()))
  const taskListSlice    = useRef($prose(() => createTaskListPlugin()))
  const frontMatterSlice = useRef($prose(() => createFrontMatterPlugin()))
  const mermaidSlice     = useRef($prose(() => createMermaidPlugin()))
  const shortcutSlice    = useRef($prose(() => createShortcutPlugin()))
  const findSlice        = useRef($prose(() => createFindPlugin()))

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
  )

  function dispatchAndNotify(view: any, tr: any) {
    view.dispatch(tr)
    const s = findPluginKey.getState(view.state)
    if (s) onFindStateRef.current?.(s.matches.length, s.current)
  }

  useImperativeHandle(ref, () => ({
    toggleBold:          () => { const e = get(); if (e) e.action(ctx => toggleMark('strong', ctx)) },
    toggleItalic:        () => { const e = get(); if (e) e.action(ctx => toggleMark('em', ctx)) },
    toggleStrikethrough: () => { const e = get(); if (e) e.action(ctx => toggleMark('strike_through', ctx)) },
    setHeading: (level: 0|1|2|3|4|5|6) => { const e = get(); if (e) e.action(callCommand(wrapInHeadingCommand.key, level)) },
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
        const tr = view.state.tr.setMeta(findPluginKey, { type: 'find', query, caseSensitive })
        dispatchAndNotify(view, tr)
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
        const s = findPluginKey.getState(view.state)
        if (!s || s.current < 0 || !s.matches.length) return
        const match = s.matches[s.current]
        try {
          const { TextSelection } = require('prosemirror-state')
          view.dispatch(view.state.tr.setSelection(
            TextSelection.create(view.state.doc, match.from, match.to)
          ).scrollIntoView())
        } catch {}
      })
    },
  }), [get])

  return <Milkdown />
})

export interface MilkdownAdapterProps extends EditorProps {
  editorRef?:   React.Ref<EditorHandle>
  onKeyDown?:   (e: KeyboardEvent) => void
  onFindState?: (matches: number, current: number) => void
}

export function MilkdownAdapter({ editorRef, ...props }: MilkdownAdapterProps): React.JSX.Element {
  return (
    <MilkdownProvider>
      <MilkdownEditor ref={editorRef} {...props} />
    </MilkdownProvider>
  )
}
