// src/app/api/documents/[id]/status/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/documents/[id]/status
 * Polling endpoint for document processing status.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Document ID is required' },
      { status: 400 }
    )
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      fileName: true,
      errorMessage: true,
      processedAt: true,
    },
  })

  if (!document) {
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    status: document.status,
    fileName: document.fileName,
    errorMessage: document.errorMessage,
    processedAt: document.processedAt?.toISOString(),
  })
}
