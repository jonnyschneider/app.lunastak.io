import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';

const GUEST_COOKIE_NAME = 'guestUserId';

/**
 * Root page - always redirects to a project page
 * Nobody sees a "homepage" - all users land on their project
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const cookieStore = await cookies();

  // If projectId param provided, redirect to that project
  if (params.projectId && typeof params.projectId === 'string') {
    redirect(`/project/${params.projectId}`);
  }

  // If user just signed out and not authenticated, redirect to signin page instead of creating new guest
  if (params.signedOut === 'true' && !session?.user?.id) {
    redirect('/api/auth/signin');
  }

  // Authenticated user - redirect to their first project
  if (session?.user?.id) {
    let project = await prisma.project.findFirst({
      where: { userId: session.user.id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!project) {
      // Check if there's a guest cookie - if so, transfer will handle project creation
      const guestCookie = cookieStore.get(GUEST_COOKIE_NAME);
      if (guestCookie?.value) {
        // Guest cookie exists - SessionTransferProvider will transfer projects
        // Redirect to a loading state that will refresh after transfer
        redirect('/project');
      }

      // No guest cookie and no projects - create an empty one
      project = await prisma.project.create({
        data: {
          userId: session.user.id,
          name: 'My Strategy',
          status: 'active',
        },
        select: { id: true },
      });
    }

    redirect(`/project/${project.id}`);
  }

  // Guest user flow
  const guestUserIdCookie = cookieStore.get(GUEST_COOKIE_NAME);

  if (guestUserIdCookie?.value) {
    // Validate existing guest and get their project
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserIdCookie.value },
      select: { email: true },
    });

    if (guestUser && isGuestUser(guestUser.email)) {
      const project = await prisma.project.findFirst({
        where: { userId: guestUserIdCookie.value, status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (project) {
        redirect(`/project/${project.id}`);
      }
    }
    // Invalid cookie or no project - fall through to create new guest
  }

  // Redirect to API route that creates guest and sets cookie
  redirect('/api/guest/init');
}
