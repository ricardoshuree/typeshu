import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'
import type { Node } from 'prosemirror-model'

// ── Tipos suportados ────────────────────────────────────────────────────────
type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution' | 'info' | 'danger'

const CALLOUT_TYPES = new Set<string>(['note', 'tip', 'important', 'warning', 'caution', 'info', 'danger'])

// Labels PT-BR por tipo
const CALLOUT_LABELS: Record<CalloutType, string> = {
  note:      'Nota',
  tip:       'Dica',
  important: 'Importante',
  warning:   'Aviso',
  caution:   'Atenção',
  info:      'Informação',
  danger:    'Perigo',
}

// ── SVG icons por tipo ──────────────────────────────────────────────────────
// Ícones simples, inline SVG 16×16, fill=currentColor
function getIcon(type: CalloutType): string {
  switch (type) {
    case 'note':
    case 'info':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 6.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 6.75zm0-2.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>`
    case 'tip':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM6.5 11.5l-2-2 1.06-1.06L6.5 9.38l3.94-3.94L11.5 6.5l-5 5z"/>
      </svg>`
    case 'important':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5zm0 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>`
    case 'warning':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M8.22.25a.75.75 0 0 0-1.22.57L.22 13.75A.75.75 0 0 0 .88 15h14.25a.75.75 0 0 0 .65-1.25L8.22.25zm-.47 1.81 5.8 10.5H1.96L7.75 2.06zM7.25 6v3.5a.75.75 0 0 0 1.5 0V6a.75.75 0 0 0-1.5 0zm1 5.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
      </svg>`
    case 'caution':
    case 'danger':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M4.47 1h7.06L15 4.47v7.06L11.53 15H4.47L1 11.53V4.47L4.47 1zm.62 1.5L2 4.94v6.12L5.09 14h5.82L14 11.06V4.94L10.91 2.5H5.09zM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>`
  }
}

// ── Parser: extrai tipo de callout do primeiro parágrafo de um blockquote ──
// Formato GitHub: > [!NOTE], > [!TIP], etc.
// Retorna o tipo em minúsculas ou null se não for callout
function parseCalloutType(node: Node): CalloutType | null {
  if (node.type.name !== 'blockquote') return null

  const firstChild = node.firstChild
  if (!firstChild) return null

  const text = firstChild.textContent
  const match = text.match(/^\[!([\w]+)\]/)
  if (!match) return null

  const type = match[1].toLowerCase()
  return CALLOUT_TYPES.has(type) ? (type as CalloutType) : null
}

// ── NodeView ─────────────────────────────────────────────────────────────────
class CalloutNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private type: CalloutType
  private titleEl: HTMLElement
  private getStyle: () => 'colorful' | 'minimal' | undefined

  constructor(
    node: Node,
    _view: EditorView,
    type: CalloutType,
    getStyle: () => 'colorful' | 'minimal' | undefined,
  ) {
    this.type = type
    this.getStyle = getStyle

    // Container externo — substitui o <blockquote> do ProseMirror
    this.dom = document.createElement('div')
    this.dom.setAttribute('data-callout', type)
    this.dom.setAttribute('contenteditable', 'false')
    this.applyClasses()

    // Título
    this.titleEl = document.createElement('div')
    this.titleEl.className = 'callout-title'
    this.renderTitle()
    this.dom.appendChild(this.titleEl)

    // Área de conteúdo editável — ProseMirror injeta o conteúdo aqui
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'callout-body'
    this.contentDOM.setAttribute('contenteditable', 'true')
    this.dom.appendChild(this.contentDOM)
  }

  private applyClasses() {
    const style = this.getStyle() ?? 'colorful'
    this.dom.className = `callout callout--${this.type} callout--${style}`
  }

  private renderTitle() {
    const label = CALLOUT_LABELS[this.type]
    const icon  = getIcon(this.type)
    this.titleEl.innerHTML = `<span class="callout-icon">${icon}</span>${label}`
  }

  // Chamado quando o node é atualizado (ex: preferência muda entre renders)
  update(node: Node): boolean {
    // Rejeita se virou outro tipo de node
    if (node.type.name !== 'blockquote') return false
    const newType = parseCalloutType(node)
    if (!newType) return false

    // Atualiza estilo caso preferência tenha mudado
    this.applyClasses()
    return true
  }

  ignoreMutation(mutation: MutationRecord): boolean {
    // Ignora mutações no título (não editável pelo usuário)
    if (mutation.target === this.titleEl || this.titleEl.contains(mutation.target as Node)) {
      return true
    }
    return false
  }

  destroy() {
    // noop — DOM é limpo pelo ProseMirror
  }
}

// ── Plugin factory ────────────────────────────────────────────────────────────
export const calloutPluginKey = new PluginKey('callout')

export function createCalloutPlugin(
  getStyle: () => 'colorful' | 'minimal' | undefined,
): Plugin {
  return new Plugin({
    key: calloutPluginKey,
    props: {
      nodeViews: {
        blockquote(node: Node, view: EditorView, _getPos: boolean | (() => number | undefined)) {
          const type = parseCalloutType(node)
          if (!type) return undefined as unknown as NodeView
          return new CalloutNodeView(node, view, type, getStyle)
        },
      },
    },
  })
}
