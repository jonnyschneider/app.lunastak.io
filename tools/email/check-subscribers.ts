#!/usr/bin/env tsx
/**
 * Check Resend audience subscriber count and status.
 *
 * Usage: npm run check-subscribers
 */
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { resend } from '../../src/lib/resend'

async function checkSubscribers() {
  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) {
    console.error('❌ RESEND_AUDIENCE_ID not set')
    process.exit(1)
  }

  console.log('📊 Checking subscriber status...\n')

  const response = await resend.contacts.list({ audienceId })
  const contacts = response.data?.data ?? []

  const subscribed = contacts.filter((c: any) => !c.unsubscribed)
  const unsubscribed = contacts.filter((c: any) => c.unsubscribed)

  console.log(`Total contacts: ${contacts.length}`)
  console.log(`  ✅ Subscribed: ${subscribed.length}`)
  console.log(`  ⏸️  Unsubscribed: ${unsubscribed.length}`)

  console.log('\n📧 First 10 subscribed contacts:')
  subscribed.slice(0, 10).forEach((c: any) => console.log(`  - ${c.email}`))
  if (subscribed.length > 10) {
    console.log(`  ... and ${subscribed.length - 10} more`)
  }
}

checkSubscribers().catch((error) => {
  console.error('Fatal:', error)
  process.exit(1)
})
