#!/usr/bin/env npx tsx
/**
 * Migrate fragment titles: parse **title** from content, split into title + body.
 *
 * Usage:
 *   npx tsx scripts/migrate-fragment-titles.ts              # dry run on dev
 *   npx tsx scripts/migrate-fragment-titles.ts --apply       # apply on dev
 *   DATABASE_URL=<prod-url> npx tsx scripts/migrate-fragment-titles.ts --dry-run
 *   DATABASE_URL=<prod-url> npx tsx scripts/migrate-fragment-titles.ts --apply
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const dryRun = !process.argv.includes('--apply')

// Parse **title** from start of content, return { title, body }
function parseMarkdownTitle(content: string): { title: string; body: string } | null {
  // Match **Title** at the start, followed by newlines and body
  const match = content.match(/^\*\*(.+?)\*\*\s*\n\n?([\s\S]*)$/)
  if (match) {
    return {
      title: match[1].trim(),
      body: match[2].trim(),
    }
  }
  return null
}

// Fallback: use first ~80 chars as title
function fallbackTitle(content: string): string {
  const firstLine = content.split('\n')[0].trim()
  if (firstLine.length <= 80) return firstLine
  return firstLine.slice(0, 77) + '...'
}

async function main() {
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '✏️  APPLYING'} — migrate fragment titles\n`)

  const fragments = await prisma.fragment.findMany({
    where: { title: null },
    select: { id: true, content: true, contentType: true, sourceType: true },
  })

  console.log(`Found ${fragments.length} fragments without title\n`)

  let parsed = 0
  let fallback = 0
  let skipped = 0

  for (const frag of fragments) {
    const result = parseMarkdownTitle(frag.content)

    if (result) {
      parsed++
      if (dryRun) {
        console.log(`  ✓ PARSE  [${frag.id}] "${result.title}"`)
        console.log(`           body: ${result.body.slice(0, 60)}...`)
      } else {
        await prisma.fragment.update({
          where: { id: frag.id },
          data: {
            title: result.title,
            content: result.body,
          },
        })
      }
    } else if (frag.content.trim().length > 0) {
      const title = fallbackTitle(frag.content)
      fallback++
      if (dryRun) {
        console.log(`  ~ FALLBACK [${frag.id}] "${title}"`)
        console.log(`             content unchanged (no markdown pattern)`)
      } else {
        await prisma.fragment.update({
          where: { id: frag.id },
          data: { title },
          // content stays as-is
        })
      }
    } else {
      skipped++
      console.log(`  - SKIP   [${frag.id}] empty content`)
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Parsed:   ${parsed}`)
  console.log(`Fallback: ${fallback}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Total:    ${fragments.length}`)

  if (dryRun) {
    console.log(`\nRun with --apply to write changes.`)
  } else {
    console.log(`\nDone. ${parsed + fallback} fragments updated.`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
