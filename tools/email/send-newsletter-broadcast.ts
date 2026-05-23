#!/usr/bin/env tsx
/**
 * Newsletter Broadcast Sender (Resend Broadcasts API)
 *
 * Usage:
 *   npm run send-newsletter src/emails/content/2026-05-example.tsx -- --test jonny@humventures.com.au
 *   npm run send-newsletter src/emails/content/2026-05-example.tsx -- --dry-run
 *   npm run send-newsletter src/emails/content/2026-05-example.tsx -- --create-only
 *   npm run send-newsletter src/emails/content/2026-05-example.tsx
 *
 * Note: requires "--" separator before flags when using npm run.
 */
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { resend, EMAIL_CONFIG } from '../../src/lib/resend'
import { renderEmail } from '../../src/lib/render-email'
import { BroadcastTemplate, type BroadcastContent } from '../../src/emails/broadcast-template'

interface SendOptions {
  contentFile: string
  test?: string
  dryRun?: boolean
  createOnly?: boolean
  schedule?: string
}

function parseArgs(): SendOptions {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Newsletter Broadcast Sender

Usage:
  npm run send-newsletter <content-file> -- [options]

Options:
  --test <email>     Send test send to one address (transactional API)
  --dry-run          Preview details, no send, no draft
  --create-only      Create broadcast draft in Resend dashboard (no send)
  --schedule <iso>   Create and schedule (ISO 8601 or natural language)
`)
    process.exit(0)
  }

  const options: SendOptions = { contentFile: args[0] }
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--test' && args[i + 1]) { options.test = args[i + 1]; i++ }
    else if (args[i] === '--dry-run') { options.dryRun = true }
    else if (args[i] === '--create-only') { options.createOnly = true }
    else if (args[i] === '--schedule' && args[i + 1]) { options.schedule = args[i + 1]; i++ }
  }
  return options
}

async function loadContent(contentFile: string): Promise<BroadcastContent> {
  const absolutePath = path.resolve(process.cwd(), contentFile)
  console.log(`📄 Loading: ${absolutePath}`)

  const module = await import(absolutePath)
  const content = module.broadcastContent || module.default
  if (!content) {
    console.error('❌ Content file must export `broadcastContent` (named) or default.')
    process.exit(1)
  }
  return content as BroadcastContent
}

async function main() {
  const options = parseArgs()
  const content = await loadContent(options.contentFile)

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) {
    console.error('❌ RESEND_AUDIENCE_ID not set')
    process.exit(1)
  }

  console.log(`Subject: ${content.subject}`)
  console.log(`Preview: ${content.previewText}\n`)

  // Test send → transactional, single recipient
  if (options.test) {
    console.log(`📧 TEST MODE → ${options.test}\n`)
    const html = await renderEmail(
      BroadcastTemplate({ ...content, unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? '#'}/api/email/unsubscribe?token=TEST` })
    )
    const result = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.test,
      subject: `[TEST] ${content.subject}`,
      html,
    })
    console.log(`✅ Test sent. Email ID: ${result.data?.id}`)
    process.exit(0)
  }

  // Dry run
  if (options.dryRun) {
    console.log('🔍 DRY RUN — nothing sent')
    console.log(`  Audience: ${audienceId}`)
    console.log(`  Subject: ${content.subject}`)
    console.log(`  From: ${EMAIL_CONFIG.from}`)
    return
  }

  // Render with Resend merge tag for personalised unsubscribe
  const html = await renderEmail(
    BroadcastTemplate({ ...content, unsubscribeUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}' })
  )

  // Create-only mode
  if (options.createOnly) {
    console.log('📋 CREATE DRAFT MODE — no send\n')
    const createResult = await resend.broadcasts.create({
      audienceId,
      from: EMAIL_CONFIG.from,
      subject: content.subject,
      html,
    })
    if (!createResult.data?.id) {
      console.error('❌ Failed to create broadcast')
      console.error(createResult)
      process.exit(1)
    }
    console.log(`✅ Draft created: ${createResult.data.id}`)
    console.log(`   Preview: https://resend.com/broadcasts/${createResult.data.id}`)
    return
  }

  // Scheduled
  if (options.schedule) {
    console.log(`📅 SCHEDULED → ${options.schedule}\n`)
    const createResult = await resend.broadcasts.create({
      audienceId,
      from: EMAIL_CONFIG.from,
      subject: content.subject,
      html,
    })
    if (!createResult.data?.id) { console.error('❌ create failed'); process.exit(1) }
    const sendResult = await resend.broadcasts.send(createResult.data.id, { scheduledAt: options.schedule })
    if (sendResult.error) { console.error('❌ schedule failed', sendResult.error); process.exit(1) }
    console.log(`✅ Scheduled. Broadcast: ${createResult.data.id}`)
    return
  }

  // PRODUCTION SEND
  console.log('\n⚠️  PRODUCTION BROADCAST — sending to entire audience in 10 seconds')
  console.log('   Press Ctrl+C to cancel\n')
  for (let i = 10; i > 0; i--) {
    process.stdout.write(`\r   Sending in ${i}... `)
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.log('\n')

  const createResult = await resend.broadcasts.create({
    audienceId,
    from: EMAIL_CONFIG.from,
    subject: content.subject,
    html,
  })
  if (!createResult.data?.id) { console.error('❌ create failed'); process.exit(1) }

  const sendResult = await resend.broadcasts.send(createResult.data.id)
  if (sendResult.error) { console.error('❌ send failed', sendResult.error); process.exit(1) }

  console.log(`✅ SENT — broadcast ${createResult.data.id}`)
  console.log(`   Analytics: https://resend.com/broadcasts/${createResult.data.id}`)
}

main().catch((error) => {
  console.error('Fatal:', error)
  process.exit(1)
})
