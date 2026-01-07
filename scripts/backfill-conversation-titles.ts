// scripts/backfill-conversation-titles.ts
// Usage: npx dotenv -e .env -- npx tsx scripts/backfill-conversation-titles.ts

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const PROJECT_ID = 'cmjy84rpx0005jcka19ieqs3n'

const TITLE_PROMPT = `Based on this business strategy conversation, generate a short descriptive title (3-6 words).

Conversation:
{conversation}

Output ONLY the title, nothing else. Examples: "Market expansion strategy", "Customer acquisition approach", "B2B pricing model"`

async function backfillTitles() {
  console.log(`Fetching conversations without titles for project ${PROJECT_ID}...`)

  const conversations = await prisma.conversation.findMany({
    where: {
      projectId: PROJECT_ID,
      title: null,
      status: { not: 'abandoned' },
    },
    include: {
      messages: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  })

  console.log(`Found ${conversations.length} conversations without titles`)

  for (const conv of conversations) {
    if (conv.messages.length === 0) {
      console.log(`Skipping ${conv.id} - no messages`)
      continue
    }

    const conversationHistory = conv.messages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n')

    console.log(`Generating title for ${conv.id} (${conv.messages.length} messages)...`)

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: TITLE_PROMPT.replace('{conversation}', conversationHistory),
        }],
        temperature: 0.3,
      })

      const title = response.content[0]?.type === 'text'
        ? response.content[0].text.trim()
        : null

      if (title) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { title },
        })
        console.log(`  -> "${title}"`)
      } else {
        console.log(`  -> Failed to generate title`)
      }
    } catch (error) {
      console.error(`  -> Error: ${error}`)
    }
  }

  console.log('Done!')
}

backfillTitles()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
