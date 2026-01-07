import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/projects
 * Fetches the user's projects list with summary stats
 */
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active projects for the user
    let projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
        status: 'active',
      },
      include: {
        _count: {
          select: {
            fragments: { where: { status: 'active' } },
            conversations: { where: { status: { not: 'abandoned' } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // If no projects exist, create a default one
    if (projects.length === 0) {
      const newProject = await prisma.project.create({
        data: {
          userId: session.user.id,
          name: 'My Strategy',
          status: 'active',
        },
        include: {
          _count: {
            select: {
              fragments: { where: { status: 'active' } },
              conversations: { where: { status: { not: 'abandoned' } } },
            },
          },
        },
      })
      projects = [newProject]
    }

    // Format response
    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      fragmentCount: project._count.fragments,
      conversationCount: project._count.conversations,
      updatedAt: project.updatedAt.toISOString(),
    }))

    return NextResponse.json({ projects: formattedProjects })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}
