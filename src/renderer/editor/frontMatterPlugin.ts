// [mcp-local harness] feature: fix-frontmatter-preprocess | plano: 9ba4c719 | 2026-09-17 14:37:59
// frontMatterPlugin v3: no-op, lógica movida para App.tsx + FrontMatterPanel
/**
 * frontMatterPlugin.ts (v3 — no-op)
 *
 * O YAML Front Matter é tratado no nível do App.tsx via pré-processamento:
 * o bloco ---...--- é extraído ANTES de passar o Markdown ao Milkdown,
 * e renderizado como componente React separado (FrontMatterPanel).
 *
 * Este arquivo existe apenas para não quebrar o import no MilkdownAdapter.
 */
import { Plugin, PluginKey } from 'prosemirror-state'

const frontMatterKey = new PluginKey('frontMatter')

export function createFrontMatterPlugin(): Plugin {
  return new Plugin({ key: frontMatterKey })
}
