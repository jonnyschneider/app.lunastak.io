import { NextResponse } from 'next/server'
import { GROUND_TRUTH_SELECT, onlyGroundTruths } from '@/lib/ground-truth/count'
import { prisma } from '@/lib/db'
import { requireConversationAccess, isDenied } from '@/lib/auth/guard'
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

  // Polled every 2s — the guard adds one indexed lookup per poll, which is fine. `read` to match
  // the conversation itself.
  const auth = await requireConversationAccess(conversationId, { access: 'read' })
  if (isDenied(auth)) return auth

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      status: true,
      // Ground truths, not raw fragments — the completion message promises rows the review will
      // actually show. See lib/ground-truth/count.ts.
      fragments: { where: { status: 'active' }, select: GROUND_TRUTH_SELECT },
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
        fragmentCount: onlyGroundTruths(conversation.fragments).length,
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
