'use client'

import { useState } from 'react'
import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel'

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  bg:          '#f1f5f9',
  surface:     '#ffffff',
  border:      '#e2e8f0',
  borderStrong:'#cbd5e1',
  text:        '#1e293b',
  textSub:     '#64748b',
  textDim:     '#94a3b8',
  brass:       '#B8964E',
  green:       '#16a34a',
  amber:       '#d97706',
  red:         '#dc2626',
  rowHover:    '#f8fafc',
  headerBg:    '#f8fafc',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserStat {
  uid:               string
  email:             string
  name:              string
  joinedAt:          string
  ageDays:           number
  lastSignIn:        string | null
  lastScanAt:        string | null
  scanCount:         number
  aiService:         string
  plan:              string
  itemCount:         number
  avgEmailsPerDay:   number
  signalCount:       number
  aiCallsTotal:      number
  avgSignalsPerItem: number
  aiLoadScore:       number
  categoryCount:     number
  statusCounts:      Record<string, number>
  lastActive:        string | null
  totalInputTokens:  number
  totalOutputTokens: number
  aiCostUsd:         number
  fbCostUsd:         number
  totalCostUsd:      number
  lastScanCostUsd:   number
  lastScanAiCostUsd: number
  lastScanFbCostUsd: number
  totalFbReads:      number
  totalFbWrites:     number
  lastScanFbReads:   number
  lastScanFbWrites:  number
  stage1CostUsd:     number
  stage2CostUsd:     number
  reclassifyCostUsd: number
  reclassifyRuns:    number
}

interface DeletedUser {
  uid:               string
  email:             string
  name:              string
  archivedAt:        string | null
  reason:            string
  totalCostUsd:      number
  aiCostUsd:         number
  fbCostUsd:         number
  stage1CostUsd:     number
  stage2CostUsd:     number
  totalInputTokens:  number
  totalOutputTokens: number
  totalFbReads:      number
  totalFbWrites:     number
  itemCount:         number
  scanCount:         number
}

interface ScanRun {
  scanRunId:        string
  scanAt:           string
  daysBack:         number
  threadsFound:     number
  threadsProcessed: number
  newItems:         number
  updatedItems:     number
  skipped:          number
  inputTokens:      number
  outputTokens:     number
  aiCostUsd:        number
  fbReads:          number
  fbWrites:         number
  fbCostUsd:        number
  totalCostUsd:     number
  model:            string
  provider:         string
  job:              string
  durationMs:       number
}

interface Stats {
  users:        UserStat[]
  deletedUsers: DeletedUser[]
  totals: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function AiLoadBar({ score }: { score: number }) {
  const pct    = Math.min(100, Math.round(score * 10))
  const colour = pct > 70 ? C.red : pct > 40 ? C.amber : C.green
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colour, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: colour, minWidth: 28, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8, fontFamily: 'monospace', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Money({ value, dim = false }: { value: number; dim?: boolean }) {
  const colour = dim ? C.textDim : value > 1 ? C.amber : value > 0.01 ? C.textSub : C.textDim
  return <span style={{ fontFamily: 'monospace', fontSize: 12, color: colour }}>${value.toFixed(4)}</span>
}

function TH({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding: '10px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: '0.08em', textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const, background: C.headerBg, ...style }}>
      {children}
    </th>
  )
}

function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '10px 12px', verticalAlign: 'top' as const, borderBottom: `1px solid ${C.border}`, ...style }}>
      {children}
    </td>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>{children}</div>
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.textSub, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: 'monospace', fontWeight: 700, background: C.headerBg }}>
      {children}
    </div>
  )
}

// ── Cost Projection ───────────────────────────────────────────────────────────

function CostProjectionTable({ users }: { users: UserStat[] }) {
  const live = users.filter(u => u.scanCount > 0)
  const avg  = live.length > 0
    ? live.reduce((s, u) => s + (u.aiCostUsd / Math.max(u.ageDays, 1)), 0) / live.length
    : 0
  const rows    = [{ label:'Today', mult:1 }, { label:'1 week', mult:7 }, { label:'1 month', mult:30 }, { label:'3 months', mult:90 }, { label:'1 year', mult:365 }]
  const atScale = [10, 100, 1000, 10000]
  return (
    <TableWrap>
      <SectionHeader>Cost projection — {live.length} active user{live.length !== 1 ? 's' : ''}</SectionHeader>
      <div style={{ overflowX: 'auto' as const }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
          <thead><tr><TH>Period</TH><TH>Current users</TH>{atScale.map(n => <TH key={n}>{n.toLocaleString()} users</TH>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <TD><span style={{ fontFamily: 'monospace', color: C.text, fontWeight: 500 }}>{r.label}</span></TD>
                <TD><Money value={avg * r.mult * live.length} /></TD>
                {atScale.map(n => <TD key={n}><Money value={avg * r.mult * n} /></TD>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableWrap>
  )
}

// ── User Drill-Down ───────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  'claude-haiku':  'Haiku',
  'claude-sonnet': 'Sonnet',
  'gemini-flash':  'Gemini Flash',
  'gemini-pro':    'Gemini Pro',
}
const providerColour = (p: string) => p.startsWith('gemini') ? '#1a73e8' : C.brass

function UserDrillDown({ users, adminSecret }: { users: UserStat[]; adminSecret: string }) {
  const [selectedUid, setSelectedUid] = useState('')
  const [runs,        setRuns]        = useState<ScanRun[] | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const selectedUser = users.find(u => u.uid === selectedUid)

  const handleSelect = async (uid: string) => {
    setSelectedUid(uid)
    setRuns(null)
    setError(null)
    if (!uid) return
    setLoading(true)
    try {
      const res = await fetch(`/api/scan-runs?uid=${uid}`, { headers: { 'x-admin-secret': adminSecret } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRuns((await res.json()).runs ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <TableWrap>
      {/* Header row with dropdown */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, background: C.headerBg, flexWrap: 'wrap' as const }}>
        <div style={{ fontSize: 10, color: C.textSub, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: 'monospace', fontWeight: 700 }}>
          Per-User Scan Runs
        </div>
        <select
          value={selectedUid}
          onChange={e => handleSelect(e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.borderStrong}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: C.text, cursor: 'pointer', outline: 'none', minWidth: 240 }}
        >
          <option value="">Select a user…</option>
          {users.map(u => (
            <option key={u.uid} value={u.uid}>{u.name || u.email} — {u.scanCount} scan{u.scanCount !== 1 ? 's' : ''}</option>
          ))}
        </select>
        {selectedUser && (
          <span style={{ fontSize: 12, color: C.textSub }}>
            {selectedUser.itemCount} items · total <strong style={{ color: C.text }}>${selectedUser.totalCostUsd.toFixed(4)}</strong>
          </span>
        )}
      </div>

      {/* Body states */}
      {!selectedUid && <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: C.textDim, fontSize: 13 }}>Select a user above to see their scan history</div>}
      {loading    && <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: C.textSub, fontSize: 13, fontFamily: 'monospace' }}>Loading…</div>}
      {error      && <div style={{ padding: '16px 20px', color: C.red, fontSize: 12, fontFamily: 'monospace' }}>✗ {error}</div>}
      {runs && runs.length === 0 && <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: C.textDim, fontSize: 13 }}>No runs yet — will appear after the next scan</div>}

      {/* Runs table */}
      {runs && runs.length > 0 && (
        <div style={{ overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
            <thead>
              <tr>
                <TH>Time</TH><TH>Job</TH><TH>Provider</TH><TH>Threads</TH><TH>New</TH><TH>Updated</TH>
                <TH>Skipped</TH><TH>Tokens in/out</TH><TH>AI cost</TH><TH>FB r/w</TH>
                <TH>FB cost</TH><TH>Total</TH><TH>Duration</TH>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.scanRunId} onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <TD><span style={{ fontFamily: 'monospace', color: C.text, fontSize: 11 }}>{new Date(r.scanAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span></TD>
                  <TD>
                    {(() => {
                      const cfg: Record<string, { label: string; bg: string; color: string }> = {
                        onboarding: { label: 'Onboarding', bg: '#e0f2fe', color: '#0369a1' },
                        auto:       { label: 'Auto',       bg: '#f1f5f9', color: '#64748b' },
                        manual:     { label: 'Manual',     bg: '#fef3c7', color: '#d97706' },
                      }
                      const c = cfg[r.job] ?? { label: r.job, bg: '#f1f5f9', color: '#64748b' }
                      return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: c.bg, color: c.color }}>{c.label}</span>
                    })()}
                  </TD>
                  <TD>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: `${providerColour(r.provider)}18`, color: providerColour(r.provider) }}>
                      {PROVIDER_LABELS[r.provider] ?? r.provider}
                    </span>
                  </TD>
                  <TD><span style={{ fontFamily: 'monospace', color: C.textSub }}>{r.threadsFound}</span></TD>
                  <TD><span style={{ fontFamily: 'monospace', color: r.newItems > 0 ? C.green : C.textDim, fontWeight: r.newItems > 0 ? 700 : 400 }}>{r.newItems}</span></TD>
                  <TD><span style={{ fontFamily: 'monospace', color: C.textSub }}>{r.updatedItems}</span></TD>
                  <TD><span style={{ fontFamily: 'monospace', color: C.textDim }}>{r.skipped}</span></TD>
                  <TD><span style={{ fontFamily: 'monospace', color: C.textSub, fontSize: 11 }}>{(r.inputTokens/1000).toFixed(1)}k / {(r.outputTokens/1000).toFixed(1)}k</span></TD>
                  <TD><Money value={r.aiCostUsd} /></TD>
                  <TD><span style={{ fontFamily: 'monospace', color: C.textSub, fontSize: 11 }}>{r.fbReads}r / {r.fbWrites}w</span></TD>
                  <TD><Money value={r.fbCostUsd} dim /></TD>
                  <TD><Money value={r.totalCostUsd} /></TD>
                  <TD><span style={{ fontFamily: 'monospace', color: C.textDim, fontSize: 11 }}>{r.durationMs >= 1000 ? `${(r.durationMs/1000).toFixed(1)}s` : `${r.durationMs}ms`}</span></TD>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.headerBg }}>
                <TD style={{ fontWeight: 700, color: C.textSub, fontSize: 10, textTransform: 'uppercase' as const }}>Total ({runs.length})</TD>
                <TD></TD><TD></TD><TD></TD>
                <TD><span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.green }}>{runs.reduce((a,r) => a+r.newItems, 0)}</span></TD>
                <TD><span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.textSub }}>{runs.reduce((a,r) => a+r.updatedItems, 0)}</span></TD>
                <TD></TD>
                <TD><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: C.textSub }}>{(runs.reduce((a,r) => a+r.inputTokens, 0)/1000).toFixed(1)}k / {(runs.reduce((a,r) => a+r.outputTokens, 0)/1000).toFixed(1)}k</span></TD>
                <TD><Money value={runs.reduce((a,r) => a+r.aiCostUsd, 0)} /></TD>
                <TD></TD>
                <TD><Money value={runs.reduce((a,r) => a+r.fbCostUsd, 0)} dim /></TD>
                <TD><Money value={runs.reduce((a,r) => a+r.totalCostUsd, 0)} /></TD>
                <TD><span style={{ fontFamily: 'monospace', color: C.textDim, fontSize: 11 }}>avg {(runs.reduce((a,r) => a+r.durationMs, 0)/runs.length/1000).toFixed(1)}s</span></TD>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </TableWrap>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [secret,  setSecret]  = useState('')
  const [authed,  setAuthed]  = useState(false)
  const [cached,  setCached]  = useState(false)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/stats', { headers: { 'x-admin-secret': secret } })
      if (!res.ok) {
        if (res.status === 401) { setError('Invalid admin secret'); setLoading(false); return }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setStats(data); setCached(data.cached === true); setAuthed(true)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 48px', minWidth: 340, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.brass, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Keel</div>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 28, fontFamily: 'monospace' }}>Admin Console</div>
          <input type="password" value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Admin secret…" autoFocus
            style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:'10px 14px', fontSize:14, color:C.text, fontFamily:'monospace', outline:'none', boxSizing:'border-box' as const, marginBottom:12 }} />
          <button onClick={load} disabled={loading || !secret}
            style={{ width:'100%', padding:'10px', borderRadius:6, background:C.brass, border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity:!secret ? 0.5 : 1 }}>
            {loading ? 'Loading…' : 'Enter'}
          </button>
          {error && <div style={{ marginTop:12, fontSize:12, color:C.red, fontFamily:'monospace' }}>{error}</div>}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const { users, deletedUsers } = stats
  const totals = (stats as any).totals ?? (stats as any).platform ?? {}

  const totalUsers        = totals.users             ?? users.length
  const totalItems        = totals.items             ?? users.reduce((a:number, u:any) => a+(u.itemCount??0), 0)
  const totalSignals      = totals.signals           ?? users.reduce((a:number, u:any) => a+(u.signalCount??0), 0)
  const totalAiCalls      = totals.aiCalls           ?? users.reduce((a:number, u:any) => a+(u.aiCallsTotal??0), 0)
  const totalCostUsd      = totals.totalCostUsd      ?? users.reduce((a:number, u:any) => a+(u.totalCostUsd??0), 0)
  const totalAiCostUsd    = totals.totalAiCostUsd    ?? users.reduce((a:number, u:any) => a+(u.aiCostUsd??0), 0)
  const totalFbCostUsd    = totals.totalFbCostUsd    ?? users.reduce((a:number, u:any) => a+(u.fbCostUsd??0), 0)
  const totalStage1       = totals.stage1CostUsd     ?? users.reduce((a:number, u:any) => a+(u.stage1CostUsd??0), 0)
  const totalStage2       = totals.stage2CostUsd     ?? users.reduce((a:number, u:any) => a+(u.stage2CostUsd??0), 0)
  const totalFbReads      = totals.totalFbReads      ?? users.reduce((a:number, u:any) => a+(u.totalFbReads??0), 0)
  const totalFbWrites     = totals.totalFbWrites     ?? users.reduce((a:number, u:any) => a+(u.totalFbWrites??0), 0)
  const totalInputTokens  = totals.totalInputTokens  ?? users.reduce((a:number, u:any) => a+(u.totalInputTokens??0), 0)
  const totalOutputTokens = totals.totalOutputTokens ?? users.reduce((a:number, u:any) => a+(u.totalOutputTokens??0), 0)

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui, sans-serif', padding:'32px 40px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:C.brass, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>Keel</div>
          <div style={{ fontSize:11, color:C.textDim, fontFamily:'monospace', marginTop:2 }}>
            Admin Console {cached && <span style={{ color:C.textDim }}>(cached 60s)</span>}
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding:'7px 16px', borderRadius:6, background:C.surface, border:`1px solid ${C.borderStrong}`, color:C.textSub, fontSize:12, cursor:'pointer' }}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:28 }}>
        <StatCard label="Users"      value={totalUsers}                                                        sub="registered" />
        <StatCard label="Items"      value={totalItems.toLocaleString()}                                        sub="tracked" />
        <StatCard label="Signals"    value={totalSignals.toLocaleString()}                                      sub="extracted" />
        <StatCard label="AI calls"   value={totalAiCalls.toLocaleString()}                                      sub="total" />
        <StatCard label="Total cost" value={`$${Number(totalCostUsd).toFixed(4)}`}                              sub="all time" />
        <StatCard label="AI cost"    value={`$${Number(totalAiCostUsd).toFixed(4)}`}                            sub={`S1 $${Number(totalStage1).toFixed(4)} · S2 $${Number(totalStage2).toFixed(4)} · RC $${Number(users.reduce((a:number,u:any)=>a+(u.reclassifyCostUsd??0),0)).toFixed(4)}`} />
        <StatCard label="Firebase"   value={`$${Number(totalFbCostUsd).toFixed(4)}`}                            sub={`${totalFbReads.toLocaleString()}R / ${totalFbWrites.toLocaleString()}W`} />
        <StatCard label="Tokens"     value={`${((totalInputTokens+totalOutputTokens)/1000).toFixed(1)}k`}       sub={`${(totalInputTokens/1000).toFixed(1)}k in · ${(totalOutputTokens/1000).toFixed(1)}k out`} />
      </div>

      {/* Live users */}
      <div style={{ marginBottom:28 }}>
        <TableWrap>
          <SectionHeader>Live users ({users.length})</SectionHeader>
          <div style={{ overflowX:'auto' as const }}>
            <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
              <thead><tr><TH>User</TH><TH>Joined</TH><TH>Plan</TH><TH>Scans</TH><TH>Items</TH><TH>Signals</TH><TH>AI load</TH><TH>AI S1 classify</TH><TH>AI S2 merge</TH><TH>Reclassify</TH><TH>Firebase</TH><TH>Total cost</TH><TH>Last scan</TH></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid} onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <TD>
                      <div style={{ fontWeight:600, color:C.text }}>{u.name || '—'}</div>
                      <div style={{ fontSize:10, color:C.textDim, fontFamily:'monospace', marginTop:2 }}>{u.email}</div>
                    </TD>
                    <TD><span style={{ color:C.textSub, fontFamily:'monospace' }}>{new Date(u.joinedAt).toLocaleDateString('en-GB')}</span><div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{u.ageDays}d ago</div></TD>
                    <TD><span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:100, background:u.plan==='pro'?'#dcfce7':'#f1f5f9', color:u.plan==='pro'?C.green:C.textSub }}>{u.plan}</span></TD>
                    <TD><span style={{ fontFamily:'monospace', color:C.textSub }}>{u.scanCount}</span></TD>
                    <TD><span style={{ fontFamily:'monospace', color:C.textSub }}>{u.itemCount}</span></TD>
                    <TD><span style={{ fontFamily:'monospace', color:C.textSub }}>{u.signalCount}</span></TD>
                    <TD style={{ minWidth:140 }}><AiLoadBar score={u.aiLoadScore} /></TD>
                    <TD><Money value={u.stage1CostUsd??0} /></TD>
                    <TD>{(u.stage2CostUsd??0)>0 ? <Money value={u.stage2CostUsd} /> : <span style={{ color:C.textDim }}>—</span>}</TD>
                    <TD>
                      {(u.reclassifyCostUsd??0)>0 ? <><Money value={u.reclassifyCostUsd} /><div style={{ fontSize:10, color:C.textDim, fontFamily:'monospace', marginTop:2 }}>{u.reclassifyRuns} run{(u.reclassifyRuns??0)!==1?'s':''}</div></> : <span style={{ color:C.textDim }}>—</span>}
                    </TD>
                    <TD><Money value={u.fbCostUsd??0} dim /><div style={{ fontSize:10, color:C.textDim, fontFamily:'monospace', marginTop:2 }}>{u.totalFbReads}R / {u.totalFbWrites}W</div></TD>
                    <TD><Money value={u.totalCostUsd??0} /></TD>
                    <TD><span style={{ fontFamily:'monospace', fontSize:11, color:C.textSub }}>{u.lastScanAt ? new Date(u.lastScanAt).toLocaleDateString('en-GB') : '—'}</span></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWrap>
      </div>

      {/* Per-user scan run drill-down */}
      <div style={{ marginBottom:28 }}>
        <UserDrillDown users={users} adminSecret={secret} />
      </div>

      {/* Cost projection */}
      <div style={{ marginBottom:28 }}>
        <CostProjectionTable users={users} />
      </div>

      {/* Settings panel */}
      <div style={{ marginBottom:28 }}>
        <AdminSettingsPanel adminSecret={secret} />
      </div>

      {/* Deleted users */}
      {deletedUsers && deletedUsers.length > 0 && (
        <TableWrap>
          <SectionHeader>Deleted / reset users ({deletedUsers.length})</SectionHeader>
          <div style={{ overflowX:'auto' as const }}>
            <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
              <thead><tr><TH>User</TH><TH>Deleted at</TH><TH>Reason</TH><TH>Scans</TH><TH>Items</TH><TH>Total cost</TH><TH>AI S1</TH><TH>AI S2</TH><TH>Firebase</TH><TH>Tokens in/out</TH></tr></thead>
              <tbody>
                {[...deletedUsers].sort((a,b) => (b.archivedAt??'').localeCompare(a.archivedAt??'')).map((u,i) => (
                  <tr key={`${u.uid}-${i}`} onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <TD><div style={{ fontWeight:500, color:C.textSub }}>{u.name||'—'}</div><div style={{ fontSize:10, color:C.textDim, fontFamily:'monospace', marginTop:2 }}>{u.email}</div></TD>
                    <TD><span style={{ fontFamily:'monospace', fontSize:11, color:C.textSub }}>{u.archivedAt ? new Date(u.archivedAt).toLocaleString('en-GB') : '—'}</span></TD>
                    <TD><span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:100, background:'#fef3c7', color:C.amber }}>{u.reason}</span></TD>
                    <TD><span style={{ fontFamily:'monospace', color:C.textSub }}>{u.scanCount}</span></TD>
                    <TD><span style={{ fontFamily:'monospace', color:C.textSub }}>{u.itemCount}</span></TD>
                    <TD><Money value={u.totalCostUsd??0} /></TD>
                    <TD><Money value={u.stage1CostUsd??0} /></TD>
                    <TD>{(u.stage2CostUsd??0)>0 ? <Money value={u.stage2CostUsd} /> : <span style={{ color:C.textDim }}>—</span>}</TD>
                    <TD><Money value={u.fbCostUsd??0} dim /></TD>
                    <TD><span style={{ fontFamily:'monospace', fontSize:11, color:C.textSub }}>{(u.totalInputTokens/1000).toFixed(1)}k / {(u.totalOutputTokens/1000).toFixed(1)}k</span></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableWrap>
      )}
    </div>
  )
}
