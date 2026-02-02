import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      fileName: true,
      status: true,
      createdAt: true,
      processedAt: true,
      errorMessage: true,
    }
  })
  console.log('Recent documents:')
  docs.forEach(d => {
    console.log(`- ${d.fileName}: ${d.status} (created: ${d.createdAt})`)
    if (d.errorMessage) console.log(`  Error: ${d.errorMessage}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
