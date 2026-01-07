import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get the stuck document
  const doc = await prisma.document.findFirst({
    where: { status: 'processing' },
    include: { project: true }
  })

  if (!doc) {
    console.log('No processing documents found')
    return
  }

  console.log('Stuck document:', doc.fileName)
  console.log('Project ID:', doc.projectId)

  // Check fragments for this project created around the same time
  const fragments = await prisma.fragment.findMany({
    where: {
      projectId: doc.projectId,
      documentId: doc.id
    },
    orderBy: { capturedAt: 'desc' },
    take: 5
  })

  console.log('\nFragments from this document:', fragments.length)
  fragments.forEach(f => {
    const preview = f.content.substring(0, 50)
    console.log('- ' + f.contentType + ': ' + preview + '...')
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
