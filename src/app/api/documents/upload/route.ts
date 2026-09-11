import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'
import { requireProjectAccess, deepDiveInProject, isDenied } from '@/lib/auth/guard'
import { processDocument } from '@/lib/document-processing'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

/**
 * POST /api/documents/upload
 * Upload a document for processing. Signed-up users only — a guest cookie is a 401, as it always was.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string
    const uploadContext = formData.get('uploadContext') as string | null
    const deepDiveId = formData.get('deepDiveId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Validate file type
    const fileType = file.type || 'application/octet-stream'
    if (!ALLOWED_TYPES.includes(fileType) && !file.name.endsWith('.md')) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOC, DOCX, TXT, or MD files.' },
        { status: 400 }
      )
    }

    // The guard runs after the form parse because projectId arrives in the form. "No session" is
    // still a 401 before any DB access: requireUser runs first inside the guard.
    const auth = await requireProjectAccess(projectId, { guests: false, active: true })
    if (isDenied(auth)) return auth

    // deepDiveId is form input. Owning the project doesn't make any deep-dive id yours: without this
    // a known id from another project planted this document in someone else's deep dive.
    if (deepDiveId && !(await deepDiveInProject(deepDiveId, projectId))) {
      return NextResponse.json({ error: 'Deep dive not found in this project' }, { status: 400 })
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        projectId,
        fileName: file.name,
        fileType,
        fileSizeBytes: file.size,
        uploadContext: uploadContext || null,
        deepDiveId: deepDiveId || null,
        status: 'pending',
      },
    })

    // Get file content as buffer for processing
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Update status to processing before starting background task
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'processing' },
    })

    // Process document in background - continues after response sent
    waitUntil(
      processDocument(document.id, fileBuffer, fileType, uploadContext || undefined)
        .catch((error) => {
          console.error('[Upload] Background processing failed:', error)
          // Status already set to 'failed' by processDocument
        })
    )

    // Return immediately
    return NextResponse.json({
      status: 'started',
      documentId: document.id,
      fileName: document.fileName,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
