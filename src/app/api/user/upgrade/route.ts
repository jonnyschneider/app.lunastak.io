import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, isDenied } from '@/lib/auth/guard';

export async function POST(request: Request) {
  // Signed-up users only. Keyed by the session's user id — the same row the session email named.
  const requester = await requireUser({ guests: false });
  if (isDenied(requester)) return requester;

  try {
    const { feature } = await request.json();

    // Update user to Pro (set upgradedAt timestamp)
    const user = await prisma.user.update({
      where: { id: requester.userId },
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
