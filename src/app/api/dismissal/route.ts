import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

const GUEST_COOKIE_NAME = 'guestUserId'

/**
 * Get user ID from session or guest cookie
 */
async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    return session.user.id
  }

  // Check for guest cookie
  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)

  if (guestCookie?.value) {
    const guestUser = await prisma.user.findUnique({
      where: { id: guestCookie.value },
      select: { email: true },
    })

    if (guestUser && isGuestUser(guestUser.email)) {
      return guestCookie.value
    }
  }

  return null
}

/**
 * POST /api/dismissal
 * Creates a dismissal record for an item
 * Supports both authenticated users and guests
 */
export async function POST(request: Request) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { itemType, itemContent, projectId } = await request.json()

    if (!itemType || !itemContent) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, itemContent' },
        { status: 400 }
      )
    }

    // Use content directly as key (short enough for questions/dimensions)
    // Truncate to 255 chars to fit in typical string column
    const itemKey = itemContent.slice(0, 255)

    // Create the dismissal record
    await prisma.userDismissal.upsert({
      where: {
        userId_itemType_itemKey_projectId: {
          userId,
          itemType,
          itemKey,
          projectId: projectId || null,
        },
      },
      update: {},
      create: {
        userId,
        itemType,
        itemKey,
        projectId: projectId || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating dismissal:', error)
    return NextResponse.json({ error: 'Failed to create dismissal' }, { status: 500 })
  }
}

/**
 * GET /api/dismissal
 * Gets all dismissals for the current user, optionally filtered by project
 * Supports both authenticated users and guests
 */
export async function GET(request: Request) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const dismissals = await prisma.userDismissal.findMany({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
      },
      select: {
        itemType: true,
        itemKey: true,
        projectId: true,
      },
    })

    return NextResponse.json({ dismissals })
  } catch (error) {
    console.error('Error fetching dismissals:', error)
    return NextResponse.json({ error: 'Failed to fetch dismissals' }, { status: 500 })
  }
}

/**
 * DELETE /api/dismissal
 * Removes a dismissal record (restore an item)
 * Supports both authenticated users and guests
 */
export async function DELETE(request: Request) {
  const userId = await getUserId()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { itemType, itemContent, projectId } = await request.json()

    if (!itemType || !itemContent) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, itemContent' },
        { status: 400 }
      )
    }

    // Use content directly as key (matching POST)
    const itemKey = itemContent.slice(0, 255)

    await prisma.userDismissal.deleteMany({
      where: {
        userId,
        itemType,
        itemKey,
        projectId: projectId || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing dismissal:', error)
    return NextResponse.json({ error: 'Failed to remove dismissal' }, { status: 500 })
  }
}
