import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { seedDemoProject } from '@/lib/seed-demo';

/**
 * POST /api/projects/restore-demo
 * Re-seeds the demo project for a user
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if demo already exists
  const existingDemo = await prisma.project.findFirst({
    where: {
      userId: session.user.id,
      isDemo: true,
    },
  });

  if (existingDemo) {
    return NextResponse.json(
      { error: 'Demo project already exists', projectId: existingDemo.id },
      { status: 409 }
    );
  }

  try {
    const projectId = await seedDemoProject(session.user.id);

    return NextResponse.json({
      success: true,
      projectId,
    }, { status: 201 });
  } catch (error) {
    console.error('Error restoring demo project:', error);
    return NextResponse.json({ error: 'Failed to restore demo project' }, { status: 500 });
  }
}
