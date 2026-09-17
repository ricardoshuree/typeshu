---
title: Teste Front Matter e Task List
author: Ricardo Shure
date: 2026-09-17
tags: [typeshudown, teste, markdown]
status: em-desenvolvimento
---

# Teste: Front Matter e Task List

Este arquivo serve para validar duas features do TypeShuDown.

## Front Matter

O bloco `---` acima deve aparecer como um **painel cinza colapsável** no topo,
com o título "FRONT MATTER" e uma seta ▾. Clique na seta para recolher/expandir.

O conteúdo do documento começa aqui, **não** dentro do painel.

## Task List Clicável

Clique nos checkboxes abaixo para marcar/desmarcar:

- [x] Auto-pair de delimitadores funcionando
- [x] Word Count no rodapé
- [x] Fullscreen F11
- [ ] Front Matter como painel colapsável
- [ ] Task list clicável ← você está testando isso agora
- [ ] Mermaid diagrams
- [ ] Math com KaTeX
- [ ] Exportação PDF/HTML
- [ ] Outline Panel na sidebar
- [ ] Open Quickly Ctrl+P

## Bloco de código (verificar quebra de linha)

```bash
# Instalar dependências
npm install

# Rodar em modo dev
npm run dev

# Build para distribuição
npm run package
```

> Se o código acima aparece em uma linha só, o fix do `white-space: pre` no CSS não foi aplicado ainda.
