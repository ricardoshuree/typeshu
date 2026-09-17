// [mcp-local harness] feature: fix-shortcuts-v2 | plano: 8496d21f | 2026-09-17 13:32:40
// Bold/italic via ProseMirror EditorView direto, F8/F9 via handleDOMEvents
import React, { useRef, useImperativeHandle, forwardRef } from 'react'
import {
  Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx,
  type Ctx,
} from '@milkdown/core'
import { commonmark, wrapInHeadingCommand } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { callCommand } from '@milkdown/utils'
import type { EditorProps } from './EditorAdapter'

export interface EditorHandle {
  toggleBold:   () => void
  toggleItalic: () => void
  setHeading:   (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void
}

interface MilkdownEditorProps extends EditorProps {
  onKeyDown?: (e: KeyboardEvent) => void
}

/**
 * Aplica toggle de mark (bold/italic) diretamente via ProseMirror.
 * Mais confiável que callCommand pois acessa o EditorView diretamente.
 */
function applyMark(ctx: Ctx, markType: string): void {
  try {
    // Acessa o EditorView via ctx
    const { editorView } = ctx.get(rootCtx as any) as any
    if (!editorView) return

    const { state, dispatch } = editorView
    const { schema, selection, tr } = state
    const mark = schema.marks[markType]
    if (!mark) return

    const { from, to, empty } = selection
    if (empty) {
      // Toggle storedMarks quando não há seleção
      const storedMarks = state.storedMarks || []
      const hasMark = storedMarks.some((m: any) => m.type === mark)
      if (hasMark) {
        dispatch(tr.removeStoredMark(mark))
      } else {
        dispatch(tr.addStoredMark(mark.create()))
      }
    } else {
      // Toggle mark na seleção
      const hasMark = state.doc.rangeHasMark(from, to, mark)
      if (hasMark) {
        dispatch(tr.removeMark(from, to, mark).scrollIntoView())
      } else {
        dispatch(tr.addMark(from, to, mark.create()).scrollIntoView())
      }
    }
    editorView.focus()
  } catch (e) {
    console.warn('applyMark failed:', e)
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
              // F8 e F9 precisam ser capturados aqui — ProseMirror os consome
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
  )

  useImperativeHandle(ref, () => ({
    toggleBold: () => {
      const editor = get()
      if (!editor) return
      // Tenta via callCommand primeiro, fallback via ProseMirror direto
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
