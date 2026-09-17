// [mcp-local harness] feature: scaffold-electron-app | plano: a4f3314a | 2026-09-17 11:02:43
// Interface abstrata EditorAdapter — desacopla o app do Milkdown
/**
 * EditorAdapter — interface abstrata que desacopla o app do motor de edição.
 *
 * O app nunca chama a API do Milkdown diretamente: tudo passa por aqui.
 * Isso permite trocar o motor (ex: Milkdown → ProseMirror puro) sem
 * refatorar o restante do código.
 *
 * Fase 1: implementado por MilkdownAdapter
 * Fase 2+: pode ser substituído por outro adapter sem alterar App.tsx
 */
export interface EditorAdapter {
  /** Conteúdo Markdown atual do editor */
  getMarkdown(): string

  /** Substitui o conteúdo do editor */
  setMarkdown(markdown: string): void

  /** Foca o editor */
  focus(): void

  /** Modo de código-fonte (exibe Markdown bruto) */
  setSourceMode(enabled: boolean): void

  /** Modo foco (escurece linhas fora do cursor) */
  setFocusMode(enabled: boolean): void

  /** Modo máquina de escrever (linha ativa no centro vertical) */
  setTypewriterMode(enabled: boolean): void

  /** Callback chamado quando o conteúdo muda */
  onChange?: (markdown: string) => void
}

/** Props mínimas que todo componente de editor deve aceitar */
export interface EditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
  readOnly?: boolean
  focusMode?: boolean
  typewriterMode?: boolean
}
