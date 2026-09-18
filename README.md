# TypeShu

> Editor Markdown WYSIWYM desktop — clone turbinado do Typora.

Interface limpa onde o que você digita é renderizado instantaneamente. Sem modo de preview separado: você escreve e vê o resultado ao mesmo tempo.

![TypeShu](https://img.shields.io/badge/Electron-32.x-blue) ![TypeShu](https://img.shields.io/badge/Milkdown-v7-green) ![TypeShu](https://img.shields.io/badge/TypeScript-5.x-blue)

***

## Stack

| Camada    | Tecnologia                      |
| --------- | ------------------------------- |
| Shell     | Electron 32.x                   |
| Build     | Vite + electron-vite            |
| UI        | React 18 + TypeScript           |
| Editor    | Milkdown v7 (ProseMirror)       |
| Math      | KaTeX (`@milkdown/plugin-math`) |
| Diagramas | Mermaid (NodeView ProseMirror)  |

***

## Features implementadas

### Edição

| Feature           | Atalho                                         |
| ----------------- | ---------------------------------------------- |
| **Negrito**       | `Ctrl+B`                                       |
| *Itálico*         | `Ctrl+I`                                       |
| ~~Riscado~~       | `Alt+Shift+5`                                  |
| Heading 1–6       | `Ctrl+1` … `Ctrl+6`                            |
| Parágrafo         | `Ctrl+Shift+0`                                 |
| Hyperlink         | `Ctrl+K`                                       |
| Code Fence        | `Ctrl+Shift+K`                                 |
| Auto-pair         | `( ) [ ] { } " " \` \` \* \*\`                 |
| Task list         | `[ ]` / `[x]` clicável                         |
| YAML Front Matter | Painel colapsável acima do editor              |
| Math (KaTeX)      | `$...$` inline · `$$...$$` bloco               |
| Mermaid           | ` ```mermaid ` → SVG renderizado; clique edita |

### Navegação

| Feature            | Atalho         |
| ------------------ | -------------- |
| Open Quickly       | `Ctrl+P`       |
| Busca no documento | `Ctrl+F`       |
| Substituição       | `Ctrl+H`       |
| Busca em arquivos  | `Ctrl+Shift+F` |
| Toggle sidebar     | `Ctrl+Shift+L` |
| Source Mode        | `Ctrl+/`       |
| Focus Mode         | `F8`           |
| Typewriter Mode    | `F9`           |
| Fullscreen         | `F11`          |

### Arquivo

| Feature      | Atalho             |
| ------------ | ------------------ |
| Novo arquivo | `Ctrl+N`           |
| Abrir        | `Ctrl+O`           |
| Salvar       | `Ctrl+S`           |
| Salvar como  | `Ctrl+Shift+S`     |
| Export PDF   | `Ctrl+Shift+E`     |
| Export HTML  | Menu File → Export |
| Preferências | `Ctrl+,`           |

### Sidebar

* Árvore de arquivos com expansão de pastas
* Aba OUTLINE com headings clicáveis
* **Novo arquivo** (botão `＋`)
* **Renomear** (clique direito → Renomear)
* **Deletar** (clique direito → Mover para lixeira)
* Watch de arquivo externo com banner de recarga

### Preferências (`Ctrl+,`)

* **Aparência**: tema claro/escuro/sistema, fonte, tamanho, altura de linha
* **Editor**: auto-save (intervalo configurável), auto-pair, spell check
* **Markdown**: subscrito, sobrescrito, destaque (`==texto==`)

***

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em modo dev
python start.py        # ou: npm run dev
python monitor_mcp.py --terminal   # monitor MCP em janela separada

# Build para distribuição
npm run package
```

### MCP Local (`mcp-typeshurelee`)

Servidor MCP local para integração com Claude Desktop. Expõe:

* `read_file` / `write_file` — leitura e escrita de arquivos do projeto
* `propose_change` / `approve_change` — controle de mudanças com plano + aprovação
* `list_dir` — listagem de diretório

```bash
# Verificar ambiente
python start.py --check
```

***

## Estrutura do projeto

```
src/
  main/
    index.ts          — Electron main; CSP via session.webRequest
    menu.ts           — Menu completo (File/Edit/Format/View/Window)
    ipc.ts            — Handlers IPC: arquivo, pasta, busca, watch, prefs
  preload/
    index.ts          — Whitelist de canais IPC expostos ao renderer
  shared/
    types.ts          — Tipos compartilhados: FileEntry, UserPreferences, IPC, NOTIFY
  renderer/
    App.tsx           — Estado central: arquivo, modos, find/replace, prefs
    editor/
      MilkdownAdapter.tsx   — Wrapper Milkdown com EditorHandle (bold/italic/find/replace...)
      autoPairPlugin.ts     — Plugin ProseMirror de auto-pair
      taskListPlugin.ts     — Plugin ProseMirror task list clicável
      mermaidPlugin.ts      — NodeView ProseMirror para blocos Mermaid
      shortcutPlugin.ts     — Plugin ProseMirror (strikethrough, code fence, find, replace)
      findPlugin.ts         — Plugin ProseMirror de busca com DecorationSet
      frontMatterPlugin.ts  — Plugin ProseMirror (no-op; YAML tratado no App.tsx)
    components/
      Sidebar.tsx           — Árvore de arquivos + outline + operações de arquivo
      FrontMatterPanel.tsx  — Painel YAML colapsável
      QuickOpen.tsx         — Modal Ctrl+P fuzzy
      GlobalSearch.tsx      — Painel busca em arquivos Ctrl+Shift+F
      LinkDialog.tsx        — Dialog de hyperlink Ctrl+K
      FindBar.tsx           — Barra find/replace Ctrl+F / Ctrl+H
      PrefsPanel.tsx        — Modal de preferências Ctrl+,
    styles/
      global.css            — Tokens de tema, layout, ProseMirror, todos os componentes
```

***

## Decisões técnicas

| Decisão                | Escolha                                | Motivo                                               |
| ---------------------- | -------------------------------------- | ---------------------------------------------------- |
| Motor de edição        | Milkdown v7 (ProseMirror)              | WYSIWYM nativo                                       |
| Math                   | KaTeX                                  | Mais rápido que MathJax                              |
| Mermaid                | NodeView ProseMirror                   | Decoration.widget não funciona para block nodes      |
| YAML Front Matter      | Pré-processado no App.tsx              | Milkdown converte `---` em setext H2                 |
| CSP Electron           | `session.webRequest.onHeadersReceived` | Meta-tag CSP ignorada pelo Electron                  |
| Chokidar               | `dynamic import()` em runtime          | chokidar v4 é ESM puro                               |
| EditorView no Milkdown | `ctx.get(editorViewCtx)`               | `ctx.get(rootCtx)` retorna o DOM element, não a view |
| Find/Replace           | Plugin ProseMirror com DecorationSet   | Highlight sem modificar o doc                        |

***

## Roadmap

### Próximas features (Fase 1 — \~85% completa)

* [ ] Toolbar (barra de ícones)
* [ ] Blockquote `Ctrl+Shift+Q`
* [ ] Listas `Ctrl+Shift+[` / `]`
* [ ] Tabela `Ctrl+T`
* [ ] Recent Files
* [ ] Ordenação da sidebar

### Fase 2

* [ ] Tabs múltiplas
* [ ] Temas customizáveis
* [ ] Pandoc integration
* [ ] Auto-update (`electron-updater`)
* [ ] Installer NSIS/dmg
* [ ] Localização PT-BR / EN / ZH

<br />

* lista 1
* lista 2
* lista 3

<br />

