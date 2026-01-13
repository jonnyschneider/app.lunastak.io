import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  validatePaywallRequest,
  PaywallResponseContract,
  PaywallFeature,
} from '@/lib/contracts/paywall';

const MODAL_CONTENT: Record<PaywallFeature, { title: string; message: string }> = {
  create_project: {
    title: 'Upgrade to Pro',
    message: 'Free accounts are limited to one project. Upgrade to Pro for unlimited projects and more features.',
  },
  export_pdf: {
    title: 'Upgrade to Pro',
    message: 'PDF exports are available on Pro plans. Upgrade to download your strategy as a PDF.',
  },
  add_team_member: {
    title: 'Upgrade to Team',
    message: 'Invite team members to collaborate on your strategy with a Team plan.',
  },
  advanced_analytics: {
    title: 'Upgrade to Pro',
    message: 'Access advanced analytics and insights with a Pro subscription.',
  },
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!validatePaywallRequest(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Check if user is paid
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPaid: true },
  });

  if (user?.isPaid) {
    const response: PaywallResponseContract = { blocked: false };
    return NextResponse.json(response);
  }

  // Log the upgrade intent
  await prisma.event.create({
    data: {
      conversationId: (body.context?.conversationId as string) || 'system',
      eventType: 'paywall_prompt',
      eventData: {
        feature: body.feature,
        context: body.context || null,
        userId: session.user.id,
      } as Prisma.InputJsonValue,
    },
  }).catch((err) => console.error('Failed to log paywall event:', err));

  // Return blocked response with modal
  const modalContent = MODAL_CONTENT[body.feature];
  const response: PaywallResponseContract = {
    blocked: true,
    modal: {
      title: modalContent.title,
      message: modalContent.message,
      ctaLabel: 'Learn More',
      ctaUrl: 'https://lunastak.io/pricing',
    },
  };

  return NextResponse.json(response);
}
