import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { feature } = await request.json();

    // Update user to Pro (set upgradedAt timestamp)
    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        upgradedAt: new Date(),
      },
    });

    // Log the upgrade event for analytics
    console.log('[ProUpgrade] User upgraded:', {
      userId: user.id,
      email: user.email,
      feature,
      timestamp: user.upgradedAt,
    });

    return NextResponse.json({
      success: true,
      upgradedAt: user.upgradedAt,
    });
  } catch (error) {
    console.error('[ProUpgrade] Error upgrading user:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade user' },
      { status: 500 }
    );
  }
}
