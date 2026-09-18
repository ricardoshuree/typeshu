// [mcp-local harness] feature: preferences-panel | plano: 88f6fdf3 | 2026-09-17 22:19:23
// PrefsPanel: modal com seções Aparência, Editor e Markdown com preview em tempo real
/**
 * PrefsPanel.tsx
 *
 * Modal de preferências do TypeShuDown.
 * Abre via Menu File → Preferences ou Ctrl+,
 *
 * Seções:
 *   Aparência  — tema, font size, font family, line height
 *   Editor     — auto-save, auto-pair, spell check
 *   Markdown   — extensões: subscript, superscript, highlight
 *
 * As prefs são aplicadas em tempo real enquanto o usuário ajusta.
 * Persiste via window.api.setPrefs ao fechar.
 */
import React, { useState, useEffect, useCallback } from 'react'
import type { UserPreferences } from '@shared/types'

interface PrefsPanelProps {
  prefs:    UserPreferences
  onChange: (prefs: UserPreferences) => void
  onClose:  () => void
}

const FONT_FAMILIES = [
  { label: 'Georgia (padrão)',          value: 'Georgia' },
  { label: 'Times New Roman',           value: "'Times New Roman', serif" },
  { label: 'Palatino',                  value: 'Palatino, serif' },
  { label: 'Inter / System Sans',       value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'JetBrains Mono (mono)',     value: "'JetBrains Mono', 'Fira Code', monospace" },
  { label: 'Cascadia Code (mono)',      value: "'Cascadia Code', 'Fira Code', monospace" },
]

const FONT_SIZES  = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24]
const LINE_HEIGHTS = [1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0]

type Section = 'appearance' | 'editor' | 'markdown'

export function PrefsPanel({ prefs, onChange, onClose }: PrefsPanelProps): React.JSX.Element {
  const [local, setLocal]       = useState<UserPreferences>(prefs)
  const [section, setSection]   = useState<Section>('appearance')

  // Aplica em tempo real
  useEffect(() => { onChange(local) }, [local])

  function set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setLocal(p => ({ ...p, [key]: value }))
  }

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div className="prefs-overlay" onClick={handleBackdrop} onKeyDown={handleKeyDown}>
      <div className="prefs-modal" role="dialog" aria-label="Preferências">

        {/* Header */}
        <div className="prefs-header">
          <span className="prefs-title">Preferências</span>
          <button className="prefs-close" onClick={onClose} title="Fechar (Esc)">✕</button>
        </div>

        <div className="prefs-body">
          {/* Nav lateral */}
          <nav className="prefs-nav">
            {([
              ['appearance', '🎨', 'Aparência'],
              ['editor',     '⚙️', 'Editor'],
              ['markdown',   '✳️', 'Markdown'],
            ] as [Section, string, string][]).map(([id, icon, label]) => (
              <button
                key={id}
                className={`prefs-nav-item ${section === id ? 'prefs-nav-item--active' : ''}`}
                onClick={() => setSection(id)}
              >
                <span className="prefs-nav-icon">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <div className="prefs-content">

            {/* ── Aparência ── */}
            {section === 'appearance' && (
              <div className="prefs-section">
                <h3 className="prefs-section-title">Aparência</h3>

                <div className="prefs-field">
                  <label className="prefs-label">Tema</label>
                  <div className="prefs-radio-group">
                    {([['system','Sistema'],['light','Claro'],['dark','Escuro']] as const).map(([v, l]) => (
                      <label key={v} className="prefs-radio">
                        <input type="radio" name="theme" value={v} checked={local.theme === v} onChange={() => set('theme', v)} />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="prefs-field">
                  <label className="prefs-label">Fonte do editor</label>
                  <select className="prefs-select" value={local.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div className="prefs-field">
                  <label className="prefs-label">Tamanho da fonte</label>
                  <div className="prefs-row">
                    <input
                      type="range" min={12} max={24} step={1}
                      value={local.fontSize}
                      onChange={e => set('fontSize', Number(e.target.value))}
                      className="prefs-range"
                    />
                    <span className="prefs-value">{local.fontSize}px</span>
                  </div>
                  <div className="prefs-chips">
                    {FONT_SIZES.map(s => (
                      <button
                        key={s}
                        className={`prefs-chip ${local.fontSize === s ? 'prefs-chip--active' : ''}`}
                        onClick={() => set('fontSize', s)}
                      >{s}</button>
                    ))}
                  </div>
                </div>

                <div className="prefs-field">
                  <label className="prefs-label">Altura da linha</label>
                  <div className="prefs-row">
                    <input
                      type="range" min={1.3} max={2.0} step={0.1}
                      value={local.lineHeight}
                      onChange={e => set('lineHeight', Number(e.target.value))}
                      className="prefs-range"
                    />
                    <span className="prefs-value">{local.lineHeight.toFixed(1)}</span>
                  </div>
                  <div className="prefs-chips">
                    {LINE_HEIGHTS.map(h => (
                      <button
                        key={h}
                        className={`prefs-chip ${Math.abs(local.lineHeight - h) < 0.05 ? 'prefs-chip--active' : ''}`}
                        onClick={() => set('lineHeight', h)}
                      >{h.toFixed(1)}</button>
                    ))}
                  </div>
                </div>

                {/* Preview da fonte */}
                <div
                  className="prefs-preview"
                  style={{ fontFamily: local.fontFamily, fontSize: local.fontSize, lineHeight: local.lineHeight }}
                >
                  The quick brown fox jumps over the lazy dog.<br />
                  <strong>Negrito</strong> · <em>Itálico</em> · <code>código inline</code>
                </div>
              </div>
            )}

            {/* ── Editor ── */}
            {section === 'editor' && (
              <div className="prefs-section">
                <h3 className="prefs-section-title">Editor</h3>

                <div className="prefs-field">
                  <label className="prefs-toggle">
                    <input type="checkbox" checked={local.autoSave} onChange={e => set('autoSave', e.target.checked)} />
                    <span className="prefs-toggle-label">Auto-save</span>
                    <span className="prefs-toggle-desc">Salva automaticamente enquanto você digita</span>
                  </label>
                </div>

                {local.autoSave && (
                  <div className="prefs-field prefs-field--indented">
                    <label className="prefs-label">Intervalo do auto-save</label>
                    <div className="prefs-row">
                      <input
                        type="range" min={10} max={120} step={10}
                        value={local.autoSaveInterval}
                        onChange={e => set('autoSaveInterval', Number(e.target.value))}
                        className="prefs-range"
                      />
                      <span className="prefs-value">{local.autoSaveInterval}s</span>
                    </div>
                  </div>
                )}

                <div className="prefs-field">
                  <label className="prefs-toggle">
                    <input type="checkbox" checked={local.autoPairDelimiters} onChange={e => set('autoPairDelimiters', e.target.checked)} />
                    <span className="prefs-toggle-label">Auto-pair de delimitadores</span>
                    <span className="prefs-toggle-desc">Fecha automaticamente ( ) [ ] { } " " ` ` * *</span>
                  </label>
                </div>

                <div className="prefs-field">
                  <label className="prefs-toggle">
                    <input type="checkbox" checked={local.spellCheck} onChange={e => set('spellCheck', e.target.checked)} />
                    <span className="prefs-toggle-label">Verificação ortográfica</span>
                    <span className="prefs-toggle-desc">Sublinha palavras desconhecidas (requere reinício)</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── Markdown ── */}
            {section === 'markdown' && (
              <div className="prefs-section">
                <h3 className="prefs-section-title">Extensões Markdown</h3>
                <p className="prefs-section-desc">Funcionalidades extras além do CommonMark padrão. Alterações aplicam ao reabrir o arquivo.</p>

                <div className="prefs-field">
                  <label className="prefs-toggle">
                    <input type="checkbox" checked={local.mdSubscript} onChange={e => set('mdSubscript', e.target.checked)} />
                    <span className="prefs-toggle-label">Subscrito <code>H~2~O</code></span>
                    <span className="prefs-toggle-desc">Texto abaixo da linha com ~ ~ (H₂O, CO₂)</span>
                  </label>
                </div>

                <div className="prefs-field">
                  <label className="prefs-toggle">
                    <input type="checkbox" checked={local.mdSuperscript} onChange={e => set('mdSuperscript', e.target.checked)} />
                    <span className="prefs-toggle-label">Sobrescrito <code>E=mc^2^</code></span>
                    <span className="prefs-toggle-desc">Texto acima da linha com ^ ^ (E=mc², X²)</span>
                  </label>
                </div>

                <div className="prefs-field">
                  <label className="prefs-toggle">
                    <input type="checkbox" checked={local.mdHighlight} onChange={e => set('mdHighlight', e.target.checked)} />
                    <span className="prefs-toggle-label">Destaque <code>==texto==</code></span>
                    <span className="prefs-toggle-desc">Texto destacado com == == (como marca-texto amarelo)</span>
                  </label>
                </div>

                <div className="prefs-md-note">
                  💡 Essas extensões são processadas no modo source (Ctrl+/) e exportadas corretamente para HTML.
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="prefs-footer">
          <span className="prefs-footer-hint">Alterações aplicam em tempo real</span>
          <button className="prefs-btn prefs-btn--primary" onClick={onClose}>Fechar</button>
        </div>

      </div>
    </div>
  )
}
