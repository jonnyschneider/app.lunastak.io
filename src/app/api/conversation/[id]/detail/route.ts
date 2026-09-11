import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireConversationAccess, isDenied } from '@/lib/auth/guard'

/**
 * GET /api/conversation/[id]/detail
 * Fetches a conversation's full details including messages
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  // Signed-up owners only, as it always was — not demo-readable.
  const auth = await requireConversationAccess(conversationId, { guests: false })
  if (isDenied(auth)) return auth

  try {
    // Get conversation with messages and project info
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId },
      include: {
        messages: {
          where: { stepNumber: { gt: 0 } }, // Exclude system messages
          orderBy: { stepNumber: 'asc' },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        fragments: {
          where: { status: 'active' },
          select: { id: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check if there's a trace (generated strategy) for this conversation
    const trace = await prisma.trace.findFirst({
      where: {
        conversationId: conversation.id,
      },
      select: { id: true },
    })

    return NextResponse.json({
      id: conversation.id,
      projectId: conversation.projectId,
      projectName: conversation.project?.name || 'Your Strategy',
      status: conversation.status,
      createdAt: conversation.createdAt.toISOString(),
      messages: conversation.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        stepNumber: m.stepNumber,
        createdAt: m.timestamp.toISOString(),
      })),
      fragmentCount: conversation.fragments.length,
      hasGeneratedOutput: !!trace,
    })
  } catch (error) {
    console.error('Error fetching conversation detail:', error)
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
  }
}
