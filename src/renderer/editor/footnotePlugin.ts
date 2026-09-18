// [mcp-local harness] feature: footnote-widget-fix | plano: e5123695 | 2026-09-18
// Fix: widget inserido em ref.from com side: 1 para aparecer no lugar do [^id] oculto
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as ProseMirrorNode } from 'prosemirror-model'

export const footnotePluginKey = new PluginKey('footnote')

const REF_RE = /\[\^([^\]]+)\](?!:)/g
const DEF_RE = /^\[\^([^\]]+)\]:\s*(.*)$/

interface FootnoteDef {
  id:    string
  text:  string
  pos:   number
  index: number
}

interface FootnoteRef {
  id:   string
  from: number
  to:   number
  index: number
}

function collectFootnotes(doc: ProseMirrorNode): {
  defs: Map<string, FootnoteDef>
  refs: FootnoteRef[]
  defPositions: Set<number>
} {
  const defs = new Map<string, FootnoteDef>()
  const defPositions = new Set<number>()
  const refsById = new Map<string, number>()
  const refs: FootnoteRef[] = []
  let refCounter = 0

  doc.forEach((node, offset) => {
    if (node.type.name !== 'paragraph') return
    const text = node.textContent.trim()
    const match = DEF_RE.exec(text)
    if (match) {
      defs.set(match[1], { id: match[1], text: match[2].trim(), pos: offset, index: 0 })
      defPositions.add(offset)
    }
  })

  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (!node.isText) return true
    const text = node.text ?? ''
    let match: RegExpExecArray | null
    REF_RE.lastIndex = 0
    while ((match = REF_RE.exec(text)) !== null) {
      const id   = match[1]
      const from = pos + match.index
      const to   = from + match[0].length
      if (!refsById.has(id)) {
        refsById.set(id, ++refCounter)
        const def = defs.get(id)
        if (def) def.index = refCounter
      }
      refs.push({ id, from, to, index: refsById.get(id)! })
    }
    return true
  })

  let fallback = refCounter
  defs.forEach((def) => { if (def.index === 0) def.index = ++fallback })

  return { defs, refs, defPositions }
}

export function createFootnotePlugin(): Plugin {
  return new Plugin({
    key: footnotePluginKey,
    state: {
      init(_, { doc }) { return buildDecorations(doc) },
      apply(tr, old) {
        if (!tr.docChanged) return old
        return buildDecorations(tr.doc)
      },
    },
    props: {
      decorations(state) { return this.getState(state) ?? DecorationSet.empty },
    },
  })
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const { defs, refs, defPositions } = collectFootnotes(doc)
  const decorations: Decoration[] = []

  for (const ref of refs) {
    const { id, from, to, index } = ref

    // Oculta o texto [^id] com font-size: 0
    decorations.push(
      Decoration.inline(from, to, {
        class: 'footnote-ref',
        'data-footnote-id': id,
      })
    )

    // Widget do superscript: inserido em `from` com side 1
    // Fica sobreposto ao texto oculto, visualmente no lugar certo
    decorations.push(
      Decoration.widget(from, () => {
        const sup = document.createElement('sup')
        sup.className = 'footnote-ref-num'
        const a = document.createElement('a')
        a.id          = `fnref-${id}`
        a.href        = `#fn-${id}`
        a.textContent = String(index)
        a.title       = defs.get(id)?.text ?? id
        a.onclick = (e) => {
          e.preventDefault()
          document.getElementById(`fn-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        sup.appendChild(a)
        return sup
      }, { side: 1 })
    )
  }

  // Oculta parágrafos de definição
  doc.forEach((node, offset) => {
    if (!defPositions.has(offset)) return
    decorations.push(
      Decoration.node(offset, offset + node.nodeSize, { class: 'footnote-def-hidden' })
    )
  })

  // Rodapé após o último nó
  if (defs.size > 0) {
    const sortedDefs = Array.from(defs.values()).sort((a, b) => a.index - b.index)
    decorations.push(
      Decoration.widget(doc.content.size, () => {
        const section = document.createElement('section')
        section.className = 'footnote-section'

        const hr = document.createElement('hr')
        hr.className = 'footnote-hr'
        section.appendChild(hr)

        const ol = document.createElement('ol')
        ol.className = 'footnote-list'

        for (const def of sortedDefs) {
          const li = document.createElement('li')
          li.id = `fn-${def.id}`
          li.className = 'footnote-item'

          const span = document.createElement('span')
          span.className = 'footnote-text'
          span.textContent = def.text

          const back = document.createElement('a')
          back.href = `#fnref-${def.id}`
          back.className = 'footnote-backref'
          back.textContent = '↩'
          back.onclick = (e) => {
            e.preventDefault()
            document.getElementById(`fnref-${def.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }

          li.appendChild(span)
          li.appendChild(back)
          ol.appendChild(li)
        }

        section.appendChild(ol)
        return section
      }, { side: 1 })
    )
  }

  return DecorationSet.create(doc, decorations)
}
