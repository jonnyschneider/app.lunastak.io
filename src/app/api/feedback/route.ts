import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { traceId, userId, responseText } = await request.json()

    // Validate required fields
    if (!traceId || !responseText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        traceId,
        userId: userId || null,
        responseText,
      },
    })

    return NextResponse.json({ success: true, feedbackId: feedback.id })
  } catch (error) {
    console.error('Failed to save feedback:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
