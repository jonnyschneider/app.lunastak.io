import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.document.updateMany({
    where: { status: 'processing' },
    data: {
      status: 'failed',
      errorMessage: 'Processing terminated - serverless function timeout'
    }
  })
  console.log('Fixed', result.count, 'stuck documents')
}

main().catch(console.error).finally(() => prisma.$disconnect())
