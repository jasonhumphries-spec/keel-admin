/**
 * /api/ai-config/route.ts
 *
 * GET  — returns current AI provider config from Firestore /config/aiProvider
 * POST — updates the AI provider config (admin secret required)
 *
 * Firestore doc shape:
 *   /config/aiProvider
 *     provider: 'claude-sonnet' | 'gemini-flash' | 'gemini-pro'
 *     updatedAt: Timestamp
 *     updatedBy: 'admin'
 */

import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// ── Firebase Admin init ───────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

// ── Valid providers ───────────────────────────────────────────────────────────

export type AIProvider = 'claude-haiku' | 'claude-sonnet' | 'gemini-flash' | 'gemini-pro'

const VALID_PROVIDERS: AIProvider[] = ['claude-haiku', 'claude-sonnet', 'gemini-flash', 'gemini-pro']

const PROVIDER_LABELS: Record<AIProvider, string> = {
  'claude-haiku':  'Claude Haiku 4.5 (Anthropic) — fastest / cheapest',
  'claude-sonnet': 'Claude Sonnet 4.6 (Anthropic)',
  'gemini-flash':  'Gemini 2.0 Flash (Google) — fastest / cheapest',
  'gemini-pro':    'Gemini 2.5 Pro (Google) — higher quality',
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const doc = await db.collection('config').doc('aiProvider').get()

    if (!doc.exists) {
      // Return default if not yet set
      return NextResponse.json({
        provider: 'claude-haiku' as AIProvider,
        updatedAt: null,
      })
    }

    const data = doc.data()!
    return NextResponse.json({
      provider:  data.provider  as AIProvider,
      updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate().toISOString() : null,
    })
  } catch (e) {
    console.error('[ai-config GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await req.json() as { provider: AIProvider }

    if (!VALID_PROVIDERS.includes(body.provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 }
      )
    }

    await db.collection('config').doc('aiProvider').set({
      provider:  body.provider,
      updatedAt: Timestamp.now(),
      updatedBy: 'admin',
    })

    console.log(`[ai-config] Provider updated to: ${body.provider}`)

    return NextResponse.json({ ok: true, provider: body.provider })
  } catch (e) {
    console.error('[ai-config POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
