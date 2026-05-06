import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

const KEEL_APP_URL = process.env.KEEL_APP_URL ?? 'https://www.jaison.app'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { op, uid } = await req.json()
  if (!op || !uid) return NextResponse.json({ error: 'Missing op or uid' }, { status: 400 })

  const db = getAdminDb()

  try {
    switch (op) {

      // ── Flush items + signals ─────────────────────────────────────────────
      case 'flush_items': {
        const cols = ['items', 'signals']
        let total  = 0
        for (const col of cols) {
          const snap = await db.collection(`users/${uid}/${col}`).get()
          const batch = db.batch()
          snap.docs.forEach(d => batch.delete(d.ref))
          await batch.commit()
          total += snap.size
        }
        return NextResponse.json({ ok: true, message: `Deleted ${total} docs from items + signals` })
      }

      // ── Re-analyse all active items ───────────────────────────────────────
      case 'reanalyse_all': {
        const snap = await db.collection(`users/${uid}/items`)
          .where('status', 'in', ['new', 'awaiting_action', 'awaiting_reply'])
          .get()

        const itemIds = snap.docs.map(d => d.id)
        let done = 0, failed = 0

        // Process in batches of 3
        for (let i = 0; i < itemIds.length; i += 3) {
          const batch = itemIds.slice(i, i + 3)
          await Promise.all(batch.map(async itemId => {
            try {
              const res = await fetch(`${KEEL_APP_URL}/api/gmail/reanalyse`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ uid, itemId }),
              })
              if (res.ok) done++; else failed++
            } catch { failed++ }
          }))
        }

        return NextResponse.json({
          ok: true,
          message: `Re-analysed ${done} / ${itemIds.length} items${failed > 0 ? ` (${failed} failed)` : ''}`,
          done, failed, total: itemIds.length,
        })
      }

      // ── Calendar check ────────────────────────────────────────────────────
      case 'calendar_check': {
        const res = await fetch(`${KEEL_APP_URL}/api/calendar/check`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid }),
        })
        const data = await res.json()
        return NextResponse.json({
          ok: true,
          message: `Calendar check: ${data.matched ?? 0} matched, ${data.notMatched ?? 0} not matched`,
          ...data,
        })
      }

      // ── Trigger scan ──────────────────────────────────────────────────────
      case 'trigger_scan': {
        const res = await fetch(`${KEEL_APP_URL}/api/gmail/scan`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid, daysBack: 7, job: 'manual' }),
        })
        const data = await res.json()
        return NextResponse.json({
          ok: true,
          message: `Scan complete: ${data.newItems ?? 0} new, ${data.updatedItems ?? 0} updated`,
          ...data,
        })
      }

      default:
        return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[dev-ops]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
