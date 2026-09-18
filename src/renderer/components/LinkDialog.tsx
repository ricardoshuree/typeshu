// [mcp-local harness] feature: format-strikethrough-link-codefence-sidebar | plano: ee7b144b | 2026-09-17 17:43:08
// Dialog inline de hyperlink ativado por Ctrl+K
/**
 * LinkDialog.tsx
 *
 * Dialog flutuante para inserir hyperlink (Ctrl+K).
 * Aparece centralizado no topo do editor.
 * Comportamento:
 *   - Se há texto selecionado: usa como label, pede só a URL → insere [texto](url)
 *   - Se cursor vazio: pede label + URL → insere [label](url)
 *   - URL sem http: assume https://
 *   - Enter confirma, Esc cancela
 */
import React, { useState, useRef, useEffect } from 'react'

interface LinkDialogProps {
  initialLabel?: string   // texto selecionado, se houver
  onConfirm: (label: string, url: string) => void
  onClose: () => void
}

export function LinkDialog({ initialLabel = '', onConfirm, onClose }: LinkDialogProps): React.JSX.Element {
  const hasLabel   = initialLabel.trim().length > 0
  const [label, setLabel] = useState(initialLabel)
  const [url,   setUrl]   = useState('')
  const urlRef  = useRef<HTMLInputElement>(null)
  const lblRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Foca no campo mais relevante
    if (hasLabel) urlRef.current?.focus()
    else          lblRef.current?.focus()
  }, [hasLabel])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Enter')  { e.preventDefault(); handleConfirm() }
  }

  function handleConfirm() {
    const trimUrl = url.trim()
    if (!trimUrl) { urlRef.current?.focus(); return }
    const finalUrl = /^https?:\/\//i.test(trimUrl) ? trimUrl : `https://${trimUrl}`
    const finalLabel = label.trim() || finalUrl
    onConfirm(finalLabel, finalUrl)
  }

  return (
    <div className="link-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="link-dialog" onKeyDown={handleKeyDown}>
        <div className="link-dialog-title">Inserir link</div>

        {!hasLabel && (
          <div className="link-dialog-row">
            <label className="link-dialog-label">Texto</label>
            <input
              ref={lblRef}
              className="link-dialog-input"
              type="text"
              placeholder="Texto do link"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
        )}

        <div className="link-dialog-row">
          <label className="link-dialog-label">URL</label>
          <input
            ref={urlRef}
            className="link-dialog-input"
            type="text"
            placeholder="https://exemplo.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        {hasLabel && (
          <div className="link-dialog-preview">
            Resultado: <code>[{initialLabel}]({url || 'url'})</code>
          </div>
        )}

        <div className="link-dialog-actions">
          <button className="link-dialog-btn" onClick={onClose}>Cancelar</button>
          <button className="link-dialog-btn link-dialog-btn--primary" onClick={handleConfirm}>Inserir</button>
        </div>
      </div>
    </div>
  )
}
