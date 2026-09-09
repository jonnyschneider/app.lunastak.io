// src/app/api/documents/[id]/status/route.ts
import { NextResponse } from 'next/server'
import { GROUND_TRUTH_SELECT, onlyGroundTruths } from '@/lib/ground-truth/count'
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
      // The completion says how many GROUND TRUTHS arrived — not how many fragments were
      // written. System context (tensions, Luna's own turns) is never shown, so counting it here
      // would promise rows the review will not render. See lib/ground-truth/count.ts.
      fragments: { where: { status: 'active' }, select: GROUND_TRUTH_SELECT },
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
    fragmentCount: onlyGroundTruths(document.fragments).length,
    fileName: document.fileName,
    errorMessage: document.errorMessage,
    processedAt: document.processedAt?.toISOString(),
  })
}
