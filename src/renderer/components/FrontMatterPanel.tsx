// [mcp-local harness] feature: fix-frontmatter-preprocess | plano: 9ba4c719 | 2026-09-17 14:38:09
// Componente React FrontMatterPanel com extractFrontMatter helper
/**
 * FrontMatterPanel.tsx
 *
 * Painel visual colapsável para exibir o YAML Front Matter de um documento.
 * Renderizado acima do editor Milkdown quando o arquivo começa com ---...---
 */
import React, { useState } from 'react'

interface FrontMatterPanelProps {
  content: string   // conteúdo YAML bruto (sem os delimitadores ---)
}

export function FrontMatterPanel({ content }: FrontMatterPanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className={`front-matter-panel${expanded ? ' is-expanded' : ''}`}>
      <div
        className="front-matter-header"
        onMouseDown={(e) => { e.preventDefault(); setExpanded(v => !v) }}
      >
        <span className="front-matter-icon">{expanded ? '▾' : '▸'}</span>
        <span>Front Matter</span>
      </div>
      <pre className="front-matter-body">{content}</pre>
    </div>
  )
}

/**
 * Extrai o bloco YAML Front Matter do início de um Markdown.
 *
 * Retorna null se não houver front matter, ou:
 *   - content: o YAML bruto (sem ---)
 *   - body:    o restante do Markdown sem o bloco front matter
 */
export function extractFrontMatter(
  markdown: string
): { content: string; body: string } | null {
  // O bloco deve começar na primeira linha com --- e fechar com --- em linha própria
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return null
  return {
    content: match[1].trim(),
    body:    match[2],
  }
}
