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

function daysSince(date: Date): number {
  return Math.max(1, Math.floor((Date.now() - date.getTime()) / 86400000))
}

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
  totalInputTokens:  number
  totalOutputTokens: number
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
  lastActive:        string | null
  aiCostUsd:         number
  fbCostUsd:         number
}

// Simple in-memory cache — avoids hammering Firestore on rapid refreshes
let statsCache: { data: any; at: number } | null = null
const CACHE_TTL_MS = 60_000 // 60 seconds

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Return cached result if fresh
  if (statsCache && Date.now() - statsCache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...statsCache.data, cached: true })
  }

  try {
    const db = getAdminDb()

    const userRefs = await db.collection('users').listDocuments()

    const userStats = await Promise.all(
      userRefs.map(async (userRef): Promise<UserStat | null> => {
        const uid = userRef.id
        try {
          // Parallelise all reads for this user
          const [accountDoc, itemsSnap, signalsSnap, catsSnap, usageDoc] = await Promise.all([
            db.doc(`users/${uid}/accounts/account_primary`).get(),
            db.collection(`users/${uid}/items`).select('status', 'updatedAt').get(),
            db.collection(`users/${uid}/signals`).select().get(),
            db.collection(`users/${uid}/categories`).select().get(),
            db.doc(`users/${uid}/meta/usage`).get(),
          ])

          if (!accountDoc.exists) return null

          const account    = accountDoc.data()!
          const email      = account.email as string ?? ''
          const name       = (account.displayName as string) ?? ''
          const joinedAt   = toDate(account.createdAt)
          const ageDays    = daysSince(joinedAt)
          const lastSignIn = account.lastSignIn ? toDate(account.lastSignIn) : null
          const lastScanAt = account.lastScanAt ? toDate(account.lastScanAt) : null
          const scanCount  = account.scanCount as number ?? 0
          const aiService  = account.aiService as string ?? 'claude'
          const plan       = account.plan as string ?? 'free_trial'

          // Items — only fetching status + updatedAt fields
          const itemCount  = itemsSnap.size
          const statusCounts: Record<string, number> = {}
          let lastActive: Date | null = null
          for (const d of itemsSnap.docs) {
            const data = d.data()
            const s    = data.status as string
            statusCounts[s] = (statusCounts[s] ?? 0) + 1
            const updatedAt = toDate(data.updatedAt)
            if (!lastActive || updatedAt > lastActive) lastActive = updatedAt
          }

          const signalCount = signalsSnap.size

          // Usage / cost
          const usage          = usageDoc.data() ?? {}
          const totalInputTok  = (usage.totalInputTokens  as number) ?? 0
          const totalOutputTok = (usage.totalOutputTokens as number) ?? 0
          const aiCostUsd      = (usage.aiCostUsd as number)
                               ?? Math.max(0, ((usage.totalCostUsd as number) ?? 0) - ((usage.fbCostUsd as number) ?? 0))
          const fbCostUsd      = (usage.fbCostUsd         as number) ?? 0
          const totalCostUsd   = (usage.totalCostUsd      as number) ?? 0
          const lastScanCost   = (usage.lastScanCostUsd   as number) ?? 0
          const totalFbReads   = (usage.totalFbReads      as number) ?? 0
          const totalFbWrites  = (usage.totalFbWrites     as number) ?? 0
          const lastScanFbReads  = (usage.lastScanFbReads  as number) ?? 0
          const lastScanFbWrites = (usage.lastScanFbWrites as number) ?? 0
          const lastScanAiCost   = (usage.lastScanAiCostUsd as number) ?? lastScanCost
          const lastScanFbCost   = (usage.lastScanFbCostUsd as number) ?? 0
          const stage1CostUsd    = (usage.stage1CostUsd as number)
                               ?? Math.max(0, aiCostUsd - ((usage.stage2CostUsd as number) ?? 0))
          const stage2CostUsd    = (usage.stage2CostUsd as number) ?? 0
          const reclassifyCostUsd = (usage.reclassifyCostUsd as number) ?? 0
          const reclassifyRuns    = (usage.reclassifyRuns    as number) ?? 0

          const avgEmailsPerDay   = Number((itemCount / ageDays).toFixed(1))
          const avgSignalsPerItem = itemCount > 0 ? Number((signalCount / itemCount).toFixed(1)) : 0
          const aiCallsTotal      = itemCount
          const aiLoadScore       = Number((aiCallsTotal * (1 + avgSignalsPerItem * 0.2)).toFixed(0))

          return {
            uid, email, name,
            joinedAt:   joinedAt.toISOString(),
            ageDays,
            lastSignIn:  lastSignIn?.toISOString() ?? null,
            lastScanAt:  lastScanAt?.toISOString() ?? null,
            scanCount,
            aiService,
            plan,
            itemCount,
            avgEmailsPerDay,
            signalCount,
            aiCallsTotal,
            avgSignalsPerItem,
            aiLoadScore,
            categoryCount:     catsSnap.size,
            statusCounts,
            lastActive:        lastActive?.toISOString() ?? null,
            totalInputTokens:  totalInputTok,
            totalOutputTokens: totalOutputTok,
            aiCostUsd,
            fbCostUsd,
            totalCostUsd,
            lastScanCostUsd:     lastScanCost,
            lastScanAiCostUsd:   lastScanAiCost,
            lastScanFbCostUsd:   lastScanFbCost,
            totalFbReads,
            totalFbWrites,
            lastScanFbReads,
            lastScanFbWrites,
            stage1CostUsd,
            stage2CostUsd,
            reclassifyCostUsd,
            reclassifyRuns,
          }

        } catch (e) {
          console.error(`Error loading user ${uid}:`, e)
          return null
        }
      })
    )

    const users = userStats.filter((u): u is UserStat => u !== null)

    // Collect archived (deleted) user stats — parallelised per user
    const deletedUsers: any[] = []
    await Promise.all(userRefs.map(async userRef => {
      const uid = userRef.id
      try {
        const metaDocs = await userRef.collection('meta').listDocuments()
        const archiveRefs = metaDocs.filter(d => d.id.startsWith('usage_archive_'))
        if (archiveRefs.length === 0) return

        // Fetch all archives + account doc in parallel
        const [archiveDocs, accountDoc] = await Promise.all([
          Promise.all(archiveRefs.map(r => r.get())),
          userRef.collection('accounts').doc('account_primary').get().catch(() => null),
        ])

        const email = accountDoc?.exists ? (accountDoc.data()?.email ?? '') : ''
        const name  = accountDoc?.exists ? (accountDoc.data()?.displayName ?? '') : ''

        for (const doc of archiveDocs) {
          const data = doc.data()
          if (!data) continue
          deletedUsers.push({
            uid,
            email: data.email ?? email,
            name:  data.displayName ?? name,
            archivedAt:        data.archivedAt ?? null,
            reason:            data.reason ?? 'dev_reset',
            totalCostUsd:      (data.totalCostUsd      as number) ?? 0,
            aiCostUsd:         (data.aiCostUsd          as number) ?? 0,
            fbCostUsd:         (data.fbCostUsd          as number) ?? 0,
            stage1CostUsd:     (data.stage1CostUsd      as number) ?? 0,
            stage2CostUsd:     (data.stage2CostUsd      as number) ?? 0,
            totalInputTokens:  (data.totalInputTokens   as number) ?? 0,
            totalOutputTokens: (data.totalOutputTokens  as number) ?? 0,
            totalFbReads:      (data.totalFbReads       as number) ?? 0,
            totalFbWrites:     (data.totalFbWrites      as number) ?? 0,
          })
        }
      } catch (e) { /* non-fatal */ }
    }))

    const result = {
      generatedAt: new Date().toISOString(),
      platform: {
        totalUsers:      users.length,
        totalItems:      users.reduce((a, u) => a + u.itemCount, 0),
        totalSignals:    users.reduce((a, u) => a + u.signalCount, 0),
        totalAiCalls:    users.reduce((a, u) => a + u.aiCallsTotal, 0),
        avgItemsPerUser: users.length > 0
          ? Number((users.reduce((a, u) => a + u.itemCount, 0) / users.length).toFixed(1))
          : 0,
        totalCostUsd:    Number(users.reduce((a, u) => a + u.totalCostUsd, 0).toFixed(4)),
        totalAiCostUsd:  Number(users.reduce((a, u) => a + (u.aiCostUsd ?? u.totalCostUsd), 0).toFixed(4)),
        totalFbCostUsd:  Number(users.reduce((a, u) => a + (u.fbCostUsd ?? 0), 0).toFixed(4)),
        totalFbReads:    users.reduce((a, u) => a + (u.totalFbReads ?? 0), 0),
        totalFbWrites:   users.reduce((a, u) => a + (u.totalFbWrites ?? 0), 0),
      },
      users:        users.sort((a, b) => b.aiLoadScore - a.aiLoadScore),
      deletedUsers: deletedUsers.sort((a, b) => new Date(b.archivedAt ?? 0).getTime() - new Date(a.archivedAt ?? 0).getTime()),
    }

    // Cache for 60s
    statsCache = { data: result, at: Date.now() }
    return NextResponse.json(result)

  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
