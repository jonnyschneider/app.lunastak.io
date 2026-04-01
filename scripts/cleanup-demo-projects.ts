#!/usr/bin/env npx tsx
/**
 * One-shot cleanup: delete demo projects and projects with specific vision statement.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Delete all demo projects
  const demoCount = await prisma.$executeRaw`DELETE FROM "Project" WHERE "isDemo" = true`
  console.log('Demo projects deleted:', demoCount)

  // 2. Find projects with the Lunastak-on-Lunastak vision statement
  const vision = "A strategic partner that's always there, not just when you can afford one"
  const matchingOutputs: Array<{ projectId: string }> = await prisma.$queryRaw`
    SELECT DISTINCT "projectId" FROM "GeneratedOutput"
    WHERE content::text LIKE '%' || ${vision} || '%'
  `
  console.log('Projects matching vision statement:', matchingOutputs.length)

  if (matchingOutputs.length > 0) {
    const projectIds = matchingOutputs.map(o => o.projectId)
    // Show what we're about to delete
    const projects: Array<{ id: string; name: string }> = await prisma.$queryRaw`
      SELECT id, name FROM "Project" WHERE id = ANY(${projectIds})
    `
    for (const p of projects) {
      console.log('  Will delete:', p.id, `"${p.name}"`)
    }

    const visionCount = await prisma.$executeRaw`DELETE FROM "Project" WHERE id = ANY(${projectIds})`
    console.log('Vision-match projects deleted:', visionCount)
  }

  // Final count
  const remaining: Array<{ count: number }> = await prisma.$queryRaw`SELECT count(*)::int as count FROM "Project"`
  console.log('Remaining projects:', remaining[0].count)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
