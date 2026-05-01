export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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

function toDate(v: unknown): Date {
  if (!v) return new Date()
  if (v instanceof Timestamp) return v.toDate()
  return new Date(v as string)
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const uid = req.nextUrl.searchParams.get('uid')
  if (!uid) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
  }

  try {
    const db   = getAdminDb()
    const snap = await db.collection(`users/${uid}/scanRuns`)
      .orderBy('scanAt', 'desc')
      .limit(50)
      .get()

    const runs = snap.docs.map(d => {
      const data = d.data()
      return {
        scanRunId:        data.scanRunId        ?? d.id,
        scanAt:           toDate(data.scanAt).toISOString(),
        daysBack:         data.daysBack         ?? 7,
        threadsFound:     data.threadsFound     ?? 0,
        threadsProcessed: data.threadsProcessed ?? 0,
        newItems:         data.newItems         ?? 0,
        updatedItems:     data.updatedItems     ?? 0,
        skipped:          data.skipped          ?? 0,
        inputTokens:      data.inputTokens      ?? 0,
        outputTokens:     data.outputTokens     ?? 0,
        aiCostUsd:        data.aiCostUsd        ?? 0,
        fbReads:          data.fbReads          ?? 0,
        fbWrites:         data.fbWrites         ?? 0,
        fbCostUsd:        data.fbCostUsd        ?? 0,
        totalCostUsd:     data.totalCostUsd     ?? 0,
        model:            data.model            ?? '—',
        provider:         data.provider         ?? '—',
        job:              data.job              ?? 'manual',
        durationMs:       data.durationMs       ?? 0,
      }
    })

    return NextResponse.json({ runs })
  } catch (e) {
    console.error('[scan-runs GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
