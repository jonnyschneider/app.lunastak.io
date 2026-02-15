import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { ExtractionStatusResponseContract } from '@/lib/contracts/extraction-status'

// Polling endpoint — must never be cached
export const dynamic = 'force-dynamic'

/**
 * Lightweight polling endpoint for extraction status.
 * Client polls every 2 seconds until conversation status is 'extracted' or 'extraction_failed'.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Conversation ID is required' },
      { status: 400 }
    )
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      status: true,
      _count: {
        select: {
          fragments: {
            where: { status: 'active' },
          },
        },
      },
    },
  })

  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    )
  }

  // Map conversation.status to extraction status
  let response: ExtractionStatusResponseContract

  switch (conversation.status) {
    case 'extracting':
      response = { status: 'extracting' }
      break
    case 'extracted':
      response = {
        status: 'extracted',
        fragmentCount: conversation._count.fragments,
      }
      break
    case 'extraction_failed':
      response = {
        status: 'extraction_failed',
        error: 'Extraction failed. Your conversation has been saved.',
      }
      break
    default:
      // Conversation hasn't started extraction yet, or is in a different state
      // Treat as still extracting (client will keep polling)
      response = { status: 'extracting' }
      break
  }

  return NextResponse.json(response)
}
