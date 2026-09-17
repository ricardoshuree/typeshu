// [mcp-local harness] feature: tasklist-frontmatter | plano: 33f8e29e | 2026-09-17 14:20:37
// Plugin de task list clicável via toggle do atributo checked no ProseMirror
/**
 * taskListPlugin.ts
 *
 * Plugin ProseMirror que torna os checkboxes de task list clicáveis.
 *
 * O GFM (via @milkdown/preset-gfm) já renderiza "- [ ] texto" e "- [x] texto"
 * como itens com checkbox, mas o checkbox é read-only por padrão.
 *
 * Este plugin intercepta cliques em elementos <input type="checkbox"> dentro
 * do editor e executa o toggle [ ] ↔ [x] diretamente no documento ProseMirror,
 * o que dispara o onChange e atualiza o Markdown de saída.
 */

import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

const taskListKey = new PluginKey('taskList')

export function createTaskListPlugin(): Plugin {
  return new Plugin({
    key: taskListKey,

    props: {
      handleDOMEvents: {
        /**
         * Intercepta clique no checkbox antes do ProseMirror processar.
         * O elemento é um <input type="checkbox"> dentro de um list_item.
         */
        mousedown(view: EditorView, event: MouseEvent): boolean {
          const target = event.target as HTMLElement
          if (
            target.tagName !== 'INPUT' ||
            (target as HTMLInputElement).type !== 'checkbox'
          ) {
            return false
          }

          // Previne o comportamento padrão do browser (que mudaria o DOM
          // sem passar pelo ProseMirror e causaria desync)
          event.preventDefault()

          // Encontra a posição do nó list_item que contém o checkbox
          const pos = view.posAtDOM(target, 0)
          if (pos < 0) return false

          const $pos   = view.state.doc.resolve(pos)
          const node   = $pos.parent

          // O nó deve ter atributo "checked" (schema do GFM task list)
          if (!Object.prototype.hasOwnProperty.call(node.attrs, 'checked')) {
            return false
          }

          const nodePos = $pos.before($pos.depth)
          const checked = node.attrs['checked'] as boolean

          // Aplica a transação: inverte o atributo "checked"
          const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...node.attrs,
            checked: !checked,
          })

          view.dispatch(tr)
          return true
        },
      },
    },
  })
}
