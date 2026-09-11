import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireTraceAccess, isDenied } from '@/lib/auth/guard'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Starring a strategy is a write, for signed-up users only.
    const auth = await requireTraceAccess(id, { guests: false })
    if (isDenied(auth)) return auth

    const body = await request.json()
    const { starred } = body

    if (typeof starred !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: starred must be a boolean' },
        { status: 400 }
      )
    }

    // Update the starred status
    const updatedTrace = await prisma.trace.update({
      where: { id },
      data: {
        starred,
        starredAt: starred ? new Date() : null,
      },
      select: {
        id: true,
        starred: true,
        starredAt: true,
      },
    })

    return NextResponse.json(updatedTrace)
  } catch (error) {
    console.error('Failed to update strategy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
