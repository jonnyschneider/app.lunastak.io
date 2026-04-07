/**
 * One-off script: set demoSlug on the existing demo projects.
 *
 * Run after `npm run prisma:push` has applied the new column to the target
 * environment. Safe to re-run (idempotent — uses update).
 *
 *   npx tsx scripts/set-demo-slugs.ts
 */
import { prisma } from '../src/lib/db'

const SLUGS: Record<string, string> = {
  cmn8anetr5kwlmbmq: 'nike',
  cmn8an6ivpa0xoehj: 'costco',
  cmn8anbaapaww1709: 'tsmc',
}

async function main() {
  for (const [id, slug] of Object.entries(SLUGS)) {
    const existing = await prisma.project.findUnique({ where: { id }, select: { id: true, isDemo: true } })
    if (!existing) {
      console.warn(`skip ${slug}: project ${id} not found`)
      continue
    }
    if (!existing.isDemo) {
      console.warn(`skip ${slug}: project ${id} is not a demo`)
      continue
    }
    await prisma.project.update({ where: { id }, data: { demoSlug: slug } })
    console.log(`set demoSlug=${slug} on ${id}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
