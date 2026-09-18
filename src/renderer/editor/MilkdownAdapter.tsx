// [mcp-local harness] feature: fix-shortcuts-v5 | plano: 672e4532 | 2026-09-17 21:32:03
// Registra shortcutPlugin; handleDOMEvents só cuida de F8/F9
// MilkdownAdapter — shortcutPlugin cuida de Ctrl+Shift+K e Alt+Shift+5
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
import { createAutoPairPlugin }  from './autoPairPlugin'
import { createTaskListPlugin }  from './taskListPlugin'
import { createFrontMatterPlugin } from './frontMatterPlugin'
import { createMermaidPlugin }   from './mermaidPlugin'
import { createShortcutPlugin }  from './shortcutPlugin'
import type { EditorProps } from './EditorAdapter'
import 'katex/dist/katex.min.css'

export interface EditorHandle {
  toggleBold:          () => void
  toggleItalic:        () => void
  toggleStrikethrough: () => void
  setHeading:          (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void
  insertCodeFence:     (lang?: string) => void
  getSelectedText:     () => string
  replaceSelectionWith:(text: string) => void
}

interface MilkdownEditorProps extends EditorProps {
  onKeyDown?: (e: KeyboardEvent) => void
}

function toggleMark(markName: string, ctx: Ctx) {
  try {
    const { editorView } = (ctx.get(rootCtx as any) as any)
    if (!editorView) return
    const { state, dispatch } = editorView
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
    editorView.focus()
  } catch (e) {
    console.warn(`toggle ${markName} error:`, e)
  }
}

function doInsertCodeFence(ctx: Ctx, lang = '') {
  try {
    const { editorView } = (ctx.get(rootCtx as any) as any)
    if (!editorView) return
    const { state, dispatch } = editorView
    const { from } = state.selection
    const fence = `\`\`\`${lang}\n\n\`\`\``
    dispatch(state.tr.insertText(fence, from, state.selection.to).scrollIntoView())
    const cursorPos = from + `\`\`\`${lang}\n`.length
    const nextState = editorView.state
    try {
      const $pos = nextState.doc.resolve(Math.min(cursorPos, nextState.doc.content.size - 1))
      const sel  = (nextState.selection.constructor as any).near($pos)
      editorView.dispatch(nextState.tr.setSelection(sel))
    } catch {}
    editorView.focus()
  } catch (e) {
    console.warn('insertCodeFence error:', e)
  }
}

const MilkdownEditor = forwardRef<EditorHandle, MilkdownEditorProps>(function MilkdownEditor(
  { initialContent = '', onChange, readOnly = false, onKeyDown },
  ref
) {
  const onChangeRef  = useRef(onChange)
  const onKeyDownRef = useRef(onKeyDown)
  const ctxRef       = useRef<Ctx | null>(null)
  onChangeRef.current  = onChange
  onKeyDownRef.current = onKeyDown

  const autoPairSlice    = useRef($prose(() => createAutoPairPlugin()))
  const taskListSlice    = useRef($prose(() => createTaskListPlugin()))
  const frontMatterSlice = useRef($prose(() => createFrontMatterPlugin()))
  const mermaidSlice     = useRef($prose(() => createMermaidPlugin()))
  // shortcutSlice: intercepta Ctrl+Shift+K e Alt+Shift+5 como plugin ProseMirror
  const shortcutSlice    = useRef($prose(() => createShortcutPlugin()))

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctxRef.current = ctx
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialContent)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnly,
          attributes: { class: 'editor', 'data-placeholder': 'Comece a digitar...' },
          handleDOMEvents: {
            keydown: (_view, event) => {
              // Apenas F8/F9 aqui — o resto vai via shortcutPlugin ou App.tsx
              if (event.key === 'F8' || event.key === 'F9') {
                onKeyDownRef.current?.(event)
                event.preventDefault()
                return true
              }
              return false
            },
          },
        }))
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChangeRef.current?.(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(math)
      .use(shortcutSlice.current)    // primeiro: maior prioridade
      .use(autoPairSlice.current)
      .use(taskListSlice.current)
      .use(frontMatterSlice.current)
      .use(mermaidSlice.current)
  )

  useImperativeHandle(ref, () => ({
    toggleBold:          () => { const e = get(); if (e) e.action(ctx => toggleMark('strong', ctx)) },
    toggleItalic:        () => { const e = get(); if (e) e.action(ctx => toggleMark('em', ctx)) },
    toggleStrikethrough: () => { const e = get(); if (e) e.action(ctx => toggleMark('strike_through', ctx)) },

    setHeading: (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
      const editor = get()
      if (editor) editor.action(callCommand(wrapInHeadingCommand.key, level))
    },

    insertCodeFence: (lang = '') => {
      const editor = get()
      if (editor) editor.action(ctx => doInsertCodeFence(ctx, lang))
    },

    getSelectedText: () => {
      const editor = get()
      if (!editor) return ''
      let selected = ''
      editor.action((ctx) => {
        try {
          const { editorView } = (ctx.get(rootCtx as any) as any)
          if (!editorView) return
          const { state } = editorView
          const { from, to } = state.selection
          selected = state.doc.textBetween(from, to, '\n')
        } catch {}
      })
      return selected
    },

    replaceSelectionWith: (text: string) => {
      const editor = get()
      if (!editor) return
      editor.action((ctx) => {
        try {
          const { editorView } = (ctx.get(rootCtx as any) as any)
          if (!editorView) return
          const { state, dispatch } = editorView
          dispatch(state.tr.insertText(text).scrollIntoView())
          editorView.focus()
        } catch (e) {
          console.warn('replaceSelectionWith error:', e)
        }
      })
    },
  }), [get])

  return <Milkdown />
})

export interface MilkdownAdapterProps extends EditorProps {
  editorRef?: React.Ref<EditorHandle>
  onKeyDown?: (e: KeyboardEvent) => void
}

export function MilkdownAdapter({ editorRef, ...props }: MilkdownAdapterProps): React.JSX.Element {
  return (
    <MilkdownProvider>
      <MilkdownEditor ref={editorRef} {...props} />
    </MilkdownProvider>
  )
}
