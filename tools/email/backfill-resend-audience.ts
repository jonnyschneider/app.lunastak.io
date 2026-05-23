#!/usr/bin/env tsx
/**
 * Backfill existing users into the Resend audience.
 *
 * Idempotent. Safe to re-run.
 * - If a contact exists and is unsubscribed=true → skip (respect prior opt-out).
 * - If a contact exists and is unsubscribed=false → skip (already in).
 * - If a contact is not found → create as subscribed.
 *
 * Usage:
 *   npm run backfill:resend-audience -- --dry-run
 *   npm run backfill:resend-audience
 */
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '../../src/lib/db'
import { resend } from '../../src/lib/resend'

const RATE_LIMIT_MS = 100 // ~10 req/sec, well under Resend's limits

interface Counts {
  total: number
  created: number
  alreadySubscribed: number
  respectingUnsubscribe: number
  errors: number
}

function splitName(name: string | null): { firstName?: string; lastName?: string } {
  if (!name) return {}
  const parts = name.trim().split(/\s+/)
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function backfill(dryRun: boolean): Promise<Counts> {
  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) {
    console.error('❌ RESEND_AUDIENCE_ID not set')
    process.exit(1)
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Found ${users.length} users in DB\n`)

  const counts: Counts = {
    total: users.length,
    created: 0,
    alreadySubscribed: 0,
    respectingUnsubscribe: 0,
    errors: 0,
  }

  for (const user of users) {
    if (!user.email || !user.email.includes('@')) {
      console.log(`⚠️  Skipping user ${user.id} (no valid email)`)
      counts.errors++
      continue
    }

    // Skip guest users (synthetic emails — see isGuestUser in src/lib/projects.ts)
    if (user.email.endsWith('@guest.lunastak.io')) {
      console.log(`⏭️  Skipping guest user: ${user.email}`)
      continue
    }

    try {
      const existing = await resend.contacts.get({ email: user.email, audienceId })

      if (existing?.data) {
        if (existing.data.unsubscribed) {
          counts.respectingUnsubscribe++
          console.log(`🚫 Respecting unsubscribe: ${user.email}`)
        } else {
          counts.alreadySubscribed++
          console.log(`✓ Already subscribed: ${user.email}`)
        }
        await sleep(RATE_LIMIT_MS)
        continue
      }
    } catch {
      // contacts.get throws when not found — fall through to create
    }

    if (dryRun) {
      console.log(`[DRY-RUN] Would create: ${user.email}`)
      counts.created++
    } else {
      try {
        const { firstName, lastName } = splitName(user.name)
        await resend.contacts.create({
          email: user.email,
          firstName,
          lastName,
          unsubscribed: false,
          audienceId,
        })
        counts.created++
        console.log(`➕ Created: ${user.email}`)
      } catch (error) {
        counts.errors++
        console.error(`❌ Error creating ${user.email}:`, error)
      }
    }

    await sleep(RATE_LIMIT_MS)
  }

  return counts
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('🔄 Resend Audience Backfill')
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`)

  const counts = await backfill(dryRun)

  console.log('\n📊 Summary')
  console.log(`  Total users:           ${counts.total}`)
  console.log(`  Created:               ${counts.created}`)
  console.log(`  Already subscribed:    ${counts.alreadySubscribed}`)
  console.log(`  Respecting unsubscribe:${counts.respectingUnsubscribe}`)
  console.log(`  Errors:                ${counts.errors}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal:', error)
  process.exit(1)
})
