#!/usr/bin/env tsx
/**
 * Unsubscribe Bounced Emails
 *
 * Manually unsubscribe a list of hard bounced email addresses from your Resend audience.
 *
 * Use Cases:
 * - Cleaning up bounced emails from previous sends
 * - Bulk unsubscribe invalid addresses before webhook was set up
 * - Processing bounce reports from Resend dashboard
 *
 * Usage:
 *   # From command line arguments
 *   npm run unsubscribe-bounced -- email1@example.com email2@example.com
 *
 *   # From a file (one email per line)
 *   npm run unsubscribe-bounced -- --file bounced-emails.txt
 *
 *   # Dry run to preview without making changes
 *   npm run unsubscribe-bounced -- --dry-run email1@example.com email2@example.com
 *   npm run unsubscribe-bounced -- --file bounced.txt --dry-run
 */

import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { resend } from '../../src/lib/resend'

interface UnsubscribeOptions {
  emails: string[]
  dryRun: boolean
}

async function parseArgs(): Promise<UnsubscribeOptions> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Unsubscribe Bounced Emails Script

Usage:
  npm run unsubscribe-bounced -- [options] [emails...]

Options:
  --file <path>      Read emails from a text file (one per line)
  --dry-run          Preview what will be unsubscribed without making changes
  --help, -h         Show this help message

Examples:
  # Unsubscribe specific emails
  npm run unsubscribe-bounced -- user@example.com bounce@test.com

  # Unsubscribe from file
  npm run unsubscribe-bounced -- --file bounced-emails.txt

  # Dry run to preview
  npm run unsubscribe-bounced -- --dry-run user@example.com

File Format (one email per line):
  user1@example.com
  user2@example.com
  user3@example.com
    `)
    process.exit(0)
  }

  const options: UnsubscribeOptions = {
    emails: [],
    dryRun: false,
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      // Read emails from file
      const filePath = path.resolve(process.cwd(), args[i + 1])

      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`)
        process.exit(1)
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const emailsFromFile = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Filter empty lines and comments
        .filter(line => line.includes('@')) // Basic email validation

      options.emails.push(...emailsFromFile)
      i++ // Skip next arg (filename)
    } else if (args[i] === '--dry-run') {
      options.dryRun = true
    } else if (args[i].includes('@')) {
      // Individual email argument
      options.emails.push(args[i])
    }
  }

  if (options.emails.length === 0) {
    console.error('❌ No email addresses provided')
    console.log('Use --help for usage information')
    process.exit(1)
  }

  return options
}

async function unsubscribeEmail(email: string, audienceId: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would unsubscribe: ${email}`)
    return true
  }

  try {
    await resend.contacts.update({
      email,
      unsubscribed: true,
      audienceId,
    })
    console.log(`  ✅ Unsubscribed: ${email}`)
    return true
  } catch (error) {
    console.error(`  ❌ Failed: ${email}`)
    if (error instanceof Error) {
      console.error(`     Error: ${error.message}`)
    }
    return false
  }
}

async function main() {
  const options = await parseArgs()
  const audienceId = process.env.RESEND_AUDIENCE_ID

  if (!audienceId) {
    console.error('❌ RESEND_AUDIENCE_ID not found in environment variables')
    process.exit(1)
  }

  // Remove duplicates
  const uniqueEmails = Array.from(new Set(options.emails))

  console.log(`\n📋 Found ${uniqueEmails.length} email(s) to unsubscribe`)

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n')
  } else {
    console.log('\n⚠️  About to unsubscribe these emails from your audience')
    console.log('   Press Ctrl+C to cancel, waiting 3 seconds...\n')
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  console.log('Processing...\n')

  let successCount = 0
  let failureCount = 0

  for (const email of uniqueEmails) {
    const success = await unsubscribeEmail(email, audienceId, options.dryRun)
    if (success) {
      successCount++
    } else {
      failureCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary')
  console.log('='.repeat(50))
  console.log(`Total processed: ${uniqueEmails.length}`)
  console.log(`✅ Successful: ${successCount}`)
  if (failureCount > 0) {
    console.log(`❌ Failed: ${failureCount}`)
  }

  if (options.dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to actually unsubscribe.')
  } else {
    console.log('\n✅ Done! Run "npm run check-subscribers" to verify the changes.')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
