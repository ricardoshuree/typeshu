// [mcp-local harness] feature: format-strikethrough-link-codefence-sidebar | plano: ee7b144b | 2026-09-17 17:43:08
// Dialog inline de hyperlink ativado por Ctrl+K
import React, { useState, useRef, useEffect } from 'react'
import { t } from '@shared/i18n'
import type { Locale } from '@shared/i18n'

interface LinkDialogProps {
  initialLabel?: string   // texto selecionado, se houver
  onConfirm: (label: string, url: string) => void
  onClose: () => void
  locale: Locale
}

export function LinkDialog({ initialLabel = '', onConfirm, onClose, locale }: LinkDialogProps): React.JSX.Element {
  const hasLabel   = initialLabel.trim().length > 0
  const [label, setLabel] = useState(initialLabel)
  const [url,   setUrl]   = useState('')
  const urlRef  = useRef<HTMLInputElement>(null)
  const lblRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
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
        <div className="link-dialog-title">{t('link.title', locale)}</div>

        {!hasLabel && (
          <div className="link-dialog-row">
            <label className="link-dialog-label">{t('link.textLabel', locale)}</label>
            <input
              ref={lblRef}
              className="link-dialog-input"
              type="text"
              placeholder={t('link.textPlaceholder', locale)}
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
        )}

        <div className="link-dialog-row">
          <label className="link-dialog-label">{t('link.urlLabel', locale)}</label>
          <input
            ref={urlRef}
            className="link-dialog-input"
            type="text"
            placeholder={t('link.urlPlaceholder', locale)}
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        {hasLabel && (
          <div className="link-dialog-preview">
            {t('link.preview', locale)} <code>[{initialLabel}]({url || 'url'})</code>
          </div>
        )}

        <div className="link-dialog-actions">
          <button className="link-dialog-btn" onClick={onClose}>{t('link.cancel', locale)}</button>
          <button className="link-dialog-btn link-dialog-btn--primary" onClick={handleConfirm}>{t('link.insert', locale)}</button>
        </div>
      </div>
    </div>
  )
}
