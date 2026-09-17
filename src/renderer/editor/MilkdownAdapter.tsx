// [mcp-local harness] feature: mermaid-katex | plano: 300c11d7 | 2026-09-17 14:55:20
// MilkdownAdapter com math (KaTeX) e mermaid integrados
// Bold/italic via ProseMirror EditorView direto, F8/F9 via handleDOMEvents
// Auto-pair, task list, front matter, mermaid e KaTeX via plugins
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
import type { EditorProps } from './EditorAdapter'

// KaTeX CSS — carregado dinamicamente para não poluir o bundle principal
import 'katex/dist/katex.min.css'

export interface EditorHandle {
  toggleBold:   () => void
  toggleItalic: () => void
  setHeading:   (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void
}

interface MilkdownEditorProps extends EditorProps {
  onKeyDown?: (e: KeyboardEvent) => void
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

  // Plugins instanciados uma vez
  const autoPairSlice    = useRef($prose(() => createAutoPairPlugin()))
  const taskListSlice    = useRef($prose(() => createTaskListPlugin()))
  const frontMatterSlice = useRef($prose(() => createFrontMatterPlugin()))
  const mermaidSlice     = useRef($prose(() => createMermaidPlugin()))

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
      .use(math)                        // KaTeX: $...$ e $$...$$
      .use(autoPairSlice.current)       // auto-pair de delimitadores
      .use(taskListSlice.current)       // task list clicável
      .use(frontMatterSlice.current)    // YAML front matter (no-op, tratado no App)
      .use(mermaidSlice.current)        // Mermaid diagrams
  )

  useImperativeHandle(ref, () => ({
    toggleBold: () => {
      const editor = get()
      if (!editor) return
      editor.action((ctx) => {
        try {
          const { editorView } = (ctx.get(rootCtx as any) as any)
          if (!editorView) return
          const { state, dispatch } = editorView
          const mark = state.schema.marks['strong']
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
          console.warn('toggleBold error:', e)
        }
      })
    },

    toggleItalic: () => {
      const editor = get()
      if (!editor) return
      editor.action((ctx) => {
        try {
          const { editorView } = (ctx.get(rootCtx as any) as any)
          if (!editorView) return
          const { state, dispatch } = editorView
          const mark = state.schema.marks['em']
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
          console.warn('toggleItalic error:', e)
        }
      })
    },

    setHeading: (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
      const editor = get()
      if (!editor) return
      editor.action(callCommand(wrapInHeadingCommand.key, level))
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
