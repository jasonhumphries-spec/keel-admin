/**
 * POST /api/admin/restore-cal-quieted (keel-admin proxy)
 *
 * Forwards the request to the keel app's /api/admin/restore-cal-quieted endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEEL_APP_URL = process.env.KEEL_APP_URL ?? 'https://www.jaison.app'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST(req: NextRequest) {
  const incomingSecret = req.headers.get('x-admin-secret')
  if (incomingSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const res  = await fetch(`${KEEL_APP_URL}/api/admin/restore-cal-quieted`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-keel-admin-secret': ADMIN_SECRET },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[admin/restore-cal-quieted proxy]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
