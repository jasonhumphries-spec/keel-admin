/**
 * AdminSettingsPanel.tsx
 *
 * Drop into your admin page component.
 * Renders a settings section with AI provider dropdown.
 *
 * Usage in admin page.tsx:
 *   import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel'
 *   ...
 *   <AdminSettingsPanel adminSecret={secret} />
 */

'use client'

import { useState, useEffect } from 'react'

type AIProvider = 'claude-haiku' | 'claude-sonnet' | 'gemini-flash' | 'gemini-pro'

const PROVIDER_OPTIONS: { value: AIProvider; label: string; badge: string; badgeColor: string }[] = [
  {
    value:      'claude-haiku',
    label:      'Claude Haiku 4.5',
    badge:      'Anthropic · fastest / cheapest',
    badgeColor: '#c0724a',
  },
  {
    value:      'claude-sonnet',
    label:      'Claude Sonnet 4.6',
    badge:      'Anthropic · higher quality',
    badgeColor: '#c0724a',
  },
  {
    value:      'gemini-flash',
    label:      'Gemini 2.5 Flash',
    badge:      'Google · cheapest',
    badgeColor: '#1a73e8',
  },
  {
    value:      'gemini-pro',
    label:      'Gemini 2.5 Pro',
    badge:      'Google · higher quality',
    badgeColor: '#1a73e8',
  },
]

interface Props {
  adminSecret: string
}

export function AdminSettingsPanel({ adminSecret }: Props) {
  const [current,  setCurrent]  = useState<AIProvider | null>(null)
  const [selected, setSelected] = useState<AIProvider>('claude-sonnet')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [message,  setMessage]  = useState<{ text: string; ok: boolean } | null>(null)

  // ── Load current config ────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/ai-config', {
          headers: { 'x-admin-secret': adminSecret },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setCurrent(data.provider)
        setSelected(data.provider)
        setUpdatedAt(data.updatedAt)
      } catch (e) {
        setMessage({ text: `Failed to load config: ${e}`, ok: false })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [adminSecret])

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async () => {
    if (selected === current) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/ai-config', {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-admin-secret':  adminSecret,
        },
        body: JSON.stringify({ provider: selected }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCurrent(selected)
      setUpdatedAt(new Date().toISOString())
      setMessage({ text: `Switched to ${PROVIDER_OPTIONS.find(p => p.value === selected)?.label}`, ok: true })
    } catch (e) {
      setMessage({ text: `Save failed: ${e}`, ok: false })
    } finally {
      setSaving(false)
    }
  }

  const isDirty = selected !== current

  // ── Styles (matches existing admin dark theme) ─────────────────────────────

  const s = {
    section: {
      background:   '#ffffff',
      border:       '1px solid #e2e8f0',
      borderRadius: 10,
      padding:      '24px 28px',
    } as React.CSSProperties,

    heading: {
      fontSize:     10,
      fontWeight:   700,
      color:        '#B8964E',
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      marginBottom: 20,
      display:      'flex',
      alignItems:   'center',
      gap:          8,
    },

    row: {
      display:        'flex',
      alignItems:     'center',
      gap:            16,
      flexWrap:       'wrap' as const,
    },

    label: {
      fontSize:  12,
      color:     '#64748b',
      minWidth:  110,
    },

    select: {
      background:   '#f8fafc',
      border:       '1px solid #cbd5e1',
      borderRadius: 6,
      padding:      '8px 12px',
      fontSize:     13,
      color:        '#1e293b',
      fontFamily:   'monospace',
      outline:      'none',
      cursor:       'pointer',
      minWidth:     280,
    } as React.CSSProperties,

    btn: {
      padding:      '8px 20px',
      borderRadius: 6,
      border:       'none',
      fontSize:     13,
      fontWeight:   700,
      cursor:       'pointer',
      transition:   'opacity 0.15s',
    } as React.CSSProperties,

    meta: {
      fontSize:  11,
      color:     '#94a3b8',
      marginTop: 12,
      fontFamily: 'monospace',
    },

    badge: (color: string) => ({
      display:      'inline-block',
      fontSize:     10,
      fontWeight:   600,
      padding:      '2px 7px',
      borderRadius: 100,
      background:   `${color}18`,
      color:        color,
      marginLeft:   8,
    } as React.CSSProperties),

    message: (ok: boolean) => ({
      marginTop:    12,
      fontSize:     12,
      color:        ok ? '#16a34a' : '#dc2626',
      fontFamily:   'monospace',
    } as React.CSSProperties),
  }

  const selectedOption = PROVIDER_OPTIONS.find(p => p.value === selected)

  return (
    <div style={s.section}>
      <div style={s.heading}>
        ⚙ Global Settings
      </div>

      {/* AI Provider row */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 500 }}>
          AI Provider
          <span style={{ color: '#334155', fontWeight: 400, marginLeft: 8 }}>
            — controls which model classifies emails for all users
          </span>
        </div>

        <div style={s.row}>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value as AIProvider)}
            style={s.select}
            disabled={loading || saving}
          >
            {PROVIDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.badge}
              </option>
            ))}
          </select>

          <button
            onClick={save}
            disabled={!isDirty || saving || loading}
            style={{
              ...s.btn,
              background: isDirty ? '#B8964E' : '#1e2533',
              color:      isDirty ? '#1C2A2E' : '#334155',
              opacity:    (!isDirty || saving) ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>

        {/* Current provider badge */}
        {current && !loading && (
          <div style={s.meta}>
            Active:&nbsp;
            <span style={{ color: '#94a3b8' }}>
              {PROVIDER_OPTIONS.find(p => p.value === current)?.label}
            </span>
            {selectedOption && (
              <span style={s.badge(selectedOption.badgeColor)}>
                {selectedOption.badge}
              </span>
            )}
            {updatedAt && (
              <span style={{ marginLeft: 12, color: '#1e2533' }}>
                last changed {new Date(updatedAt).toLocaleString('en-GB')}
              </span>
            )}
          </div>
        )}

        {loading && (
          <div style={s.meta}>Loading…</div>
        )}

        {message && (
          <div style={s.message(message.ok)}>{message.ok ? '✓' : '✗'} {message.text}</div>
        )}
      </div>

      {/* Warning if switching away from Claude */}
      {isDirty && selected !== 'claude-sonnet' && (
        <div style={{
          background:   '#fffbeb',
          border:       '1px solid #fde68a',
          borderRadius: 6,
          padding:      '10px 14px',
          fontSize:     12,
          color:        '#d97706',
          marginTop:    4,
        }}>
          ⚠ Switching provider affects all new email classifications immediately.
          Existing items in Firestore are unaffected.
          Make sure <code style={{ fontSize: 11 }}>GOOGLE_AI_API_KEY</code> is set in your environment.
        </div>
      )}
    </div>
  )
}
