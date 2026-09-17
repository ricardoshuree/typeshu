// [mcp-local harness] feature: fix-mermaid-nodeview | plano: d6d3dbd7 | 2026-09-17 15:02:26
// mermaidPlugin v2: NodeView real substituindo code_block[language=mermaid], render assíncrono, editor inline ao clicar
/**
 * mermaidPlugin.ts (v2 — NodeView real)
 *
 * Usa nodeViews do ProseMirror para substituir code_block[language=mermaid]
 * por um NodeView que renderiza o SVG via mermaid.js.
 *
 * NodeView é mais confiável que Decoration.widget porque:
 * - É chamado pelo ProseMirror imediatamente ao montar o nó no DOM
 * - Recebe atualizações quando o nó muda
 * - Controla exatamente o elemento DOM raiz
 */

import { Plugin, PluginKey } from 'prosemirror-state'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'

const mermaidKey = new PluginKey('mermaid')

let mermaidMod: any = null
let initialized   = false
let renderCounter = 0

async function getMermaid(): Promise<any> {
  if (mermaidMod) return mermaidMod
  const mod = await import('mermaid')
  mermaidMod = mod.default
  if (!initialized) {
    mermaidMod.initialize({
      startOnLoad:   false,
      theme:         'dark',
      securityLevel: 'loose',
    })
    initialized = true
  }
  return mermaidMod
}

async function renderDiagram(container: HTMLElement, code: string): Promise<void> {
  try {
    const m   = await getMermaid()
    const id  = `mermaid-svg-${++renderCounter}`
    const { svg } = await m.render(id, code.trim())
    container.innerHTML = svg
    const svgEl = container.querySelector('svg')
    if (svgEl) {
      svgEl.style.maxWidth  = '100%'
      svgEl.style.height    = 'auto'
      svgEl.removeAttribute('height')
    }
  } catch (err) {
    container.innerHTML = `<div class="mermaid-error">
      <strong>Erro no diagrama:</strong>
      <pre>${String(err).replace(/</g, '&lt;')}</pre>
    </div>`
  }
}

// ── MermaidNodeView ──────────────────────────────────────────────────────
class MermaidNodeView implements NodeView {
  dom:         HTMLElement
  contentDOM:  null = null   // sem edição inline — controlamos o DOM nós mesmos

  private renderArea:  HTMLElement
  private editorArea:  HTMLElement | null = null
  private code:        string
  private view:        EditorView
  private getPos:      () => number | undefined

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.code    = node.textContent
    this.view    = view
    this.getPos  = getPos

    // Wrapper externo
    this.dom = document.createElement('div')
    this.dom.className = 'mermaid-block'
    this.dom.setAttribute('contenteditable', 'false')

    // Área de render
    this.renderArea = document.createElement('div')
    this.renderArea.className = 'mermaid-render'
    this.dom.appendChild(this.renderArea)

    // Clique abre editor inline
    this.renderArea.addEventListener('click', () => this.openEditor())

    // Renderiza imediatamente
    renderDiagram(this.renderArea, this.code)
  }

  update(node: ProseMirrorNode): boolean {
    // Retorna false = ProseMirror cria um novo NodeView (remonta)
    // Retorna true  = atualiza este NodeView
    const newCode = node.textContent
    if (newCode === this.code) return true
    this.code = newCode
    this.closeEditor()
    renderDiagram(this.renderArea, this.code)
    return true
  }

  openEditor(): void {
    if (this.editorArea) return

    this.renderArea.style.opacity = '0.3'

    this.editorArea = document.createElement('div')
    this.editorArea.className = 'mermaid-editor'

    const hint = document.createElement('div')
    hint.className = 'mermaid-hint'
    hint.textContent = 'Edite o diagrama • Clique fora para renderizar'

    const ta = document.createElement('textarea')
    ta.className  = 'mermaid-textarea'
    ta.value      = this.code
    ta.rows       = Math.max(4, this.code.split('\n').length + 1)
    ta.spellcheck = false

    this.editorArea.appendChild(hint)
    this.editorArea.appendChild(ta)
    this.dom.appendChild(this.editorArea)
    ta.focus()

    ta.addEventListener('blur', () => {
      const newCode = ta.value
      const pos = this.getPos()
      if (pos !== undefined && newCode !== this.code) {
        const { state } = this.view
        const node = state.doc.nodeAt(pos)
        if (node) {
          const tr = state.tr.replaceWith(
            pos + 1,
            pos + node.nodeSize - 1,
            newCode ? state.schema.text(newCode) : []
          )
          this.view.dispatch(tr)
        }
      }
      this.closeEditor()
      renderDiagram(this.renderArea, newCode || this.code)
    })
  }

  closeEditor(): void {
    if (this.editorArea) {
      this.editorArea.remove()
      this.editorArea = null
    }
    this.renderArea.style.opacity = '1'
  }

  destroy(): void {
    // Limpeza automática — o DOM é removido pelo ProseMirror
  }

  stopEvent(event: Event): boolean {
    // Permite eventos no textarea interno
    return (event.target as HTMLElement)?.tagName === 'TEXTAREA'
  }

  ignoreMutation(): boolean {
    return true  // o ProseMirror não precisa rastrear mudanças no nosso DOM
  }
}

// ── Plugin ───────────────────────────────────────────────────────────────
export function createMermaidPlugin(): Plugin {
  return new Plugin({
    key: mermaidKey,

    props: {
      nodeViews: {
        // Intercepta code_block com language=mermaid ou params=mermaid
        code_block: (node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => {
          const lang = node.attrs['language'] || node.attrs['params'] || ''
          if (lang !== 'mermaid') return undefined as any
          return new MermaidNodeView(node, view, getPos)
        },
      },
    },
  })
}
