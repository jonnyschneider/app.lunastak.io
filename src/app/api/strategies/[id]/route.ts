import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { starred } = body

    if (typeof starred !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: starred must be a boolean' },
        { status: 400 }
      )
    }

    // Verify the trace belongs to the user
    const trace = await prisma.trace.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!trace) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
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
