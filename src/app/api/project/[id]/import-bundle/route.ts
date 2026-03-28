// src/app/api/project/[id]/import-bundle/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'
import { TIER_1_DIMENSIONS, type Tier1Dimension } from '@/lib/constants/dimensions'
import { randomUUID } from 'crypto'

const GUEST_COOKIE_NAME = 'guestUserId'

// Map context bundle area keys to dimension enum values
const AREA_TO_DIMENSION: Record<string, Tier1Dimension> = {
  'CUSTOMER_MARKET': 'CUSTOMER_MARKET',
  'PROBLEM_OPPORTUNITY': 'PROBLEM_OPPORTUNITY',
  'VALUE_PROPOSITION': 'VALUE_PROPOSITION',
  'DIFFERENTIATION_ADVANTAGE': 'DIFFERENTIATION_ADVANTAGE',
  'COMPETITIVE_LANDSCAPE': 'COMPETITIVE_LANDSCAPE',
  'BUSINESS_MODEL_ECONOMICS': 'BUSINESS_MODEL_ECONOMICS',
  'GO_TO_MARKET': 'GO_TO_MARKET',
  'PRODUCT_EXPERIENCE': 'PRODUCT_EXPERIENCE',
  'CAPABILITIES_ASSETS': 'CAPABILITIES_ASSETS',
  'RISKS_CONSTRAINTS': 'RISKS_CONSTRAINTS',
  'STRATEGIC_INTENT': 'STRATEGIC_INTENT',
}

interface BundleTheme {
  area: string
  theme: string
  evidence: string[]
  confidence: string
}

interface BundleQuestion {
  question: string
  area?: string
  why?: string
}

interface BundleTension {
  tension: string
  areas: string[]
}

interface ContextBundle {
  version: string
  framework: string
  themes: BundleTheme[]
  openQuestions?: BundleQuestion[]
  tensions?: BundleTension[]
  coverage?: Record<string, unknown>
  rawSummary?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const session = await getServerSession(authOptions)

  let userId: string | null = session?.user?.id || null
  if (!userId) {
    const cookieStore = await cookies()
    const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
    if (guestCookie?.value) {
      const guestUser = await prisma.user.findUnique({
        where: { id: guestCookie.value },
        select: { email: true },
      })
      if (guestUser && isGuestUser(guestUser.email)) {
        userId = guestCookie.value
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, status: 'active' },
    select: { id: true, suggestedQuestions: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let bundle: ContextBundle
  try {
    bundle = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!bundle.themes || !Array.isArray(bundle.themes) || bundle.themes.length === 0) {
    return NextResponse.json({ error: 'Bundle must contain at least one theme' }, { status: 400 })
  }

  const importBatchId = randomUUID()
  let fragmentsCreated = 0
  let questionsAdded = 0

  // Create fragments from themes
  for (const theme of bundle.themes) {
    const dimension = AREA_TO_DIMENSION[theme.area]
    if (!dimension && !TIER_1_DIMENSIONS.includes(theme.area as Tier1Dimension)) {
      continue // Skip unknown dimensions
    }
    const targetDimension = dimension || (theme.area as Tier1Dimension)

    const content = theme.evidence?.length > 0
      ? `${theme.theme}\n\nEvidence:\n${theme.evidence.map(e => `- ${e}`).join('\n')}`
      : theme.theme

    const fragment = await prisma.fragment.create({
      data: {
        projectId,
        content,
        contentType: 'insight',
        status: 'active',
        confidence: theme.confidence?.toUpperCase() || 'MEDIUM',
        sourceType: 'import',
        importBatchId,
        capturedAt: new Date(),
      },
    })

    await prisma.fragmentDimensionTag.create({
      data: {
        fragmentId: fragment.id,
        dimension: targetDimension,
        confidence: theme.confidence?.toUpperCase() || 'MEDIUM',
      },
    })

    fragmentsCreated++
  }

  // Create fragments from tensions
  if (bundle.tensions) {
    for (const tension of bundle.tensions) {
      const fragment = await prisma.fragment.create({
        data: {
          projectId,
          content: tension.tension,
          contentType: 'insight',
          status: 'active',
          confidence: 'MEDIUM',
          sourceType: 'import',
          importBatchId,
          capturedAt: new Date(),
        },
      })

      // Tag with all relevant dimensions
      for (const area of tension.areas) {
        const dim = AREA_TO_DIMENSION[area]
        if (dim) {
          await prisma.fragmentDimensionTag.create({
            data: {
              fragmentId: fragment.id,
              dimension: dim,
              confidence: 'MEDIUM',
            },
          })
        }
      }

      fragmentsCreated++
    }
  }

  // Add open questions to project's suggestedQuestions
  if (bundle.openQuestions && bundle.openQuestions.length > 0) {
    const existing = (project.suggestedQuestions as string[] | null) || []
    const newQuestions = bundle.openQuestions.map(q => q.question)
    const merged = [...existing, ...newQuestions]

    await prisma.project.update({
      where: { id: projectId },
      data: { suggestedQuestions: merged },
    })

    questionsAdded = newQuestions.length
  }

  console.log(`[ImportBundle] Imported ${fragmentsCreated} fragments, ${questionsAdded} questions for project ${projectId} (batch: ${importBatchId})`)

  return NextResponse.json({
    fragmentsCreated,
    questionsAdded,
    importBatchId,
    coverage: bundle.coverage || null,
  })
}
