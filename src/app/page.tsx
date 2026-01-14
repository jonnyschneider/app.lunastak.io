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

  // If projectId param provided, redirect to that project
  if (params.projectId && typeof params.projectId === 'string') {
    redirect(`/project/${params.projectId}`);
  }

  // Authenticated user - redirect to their first project
  if (session?.user?.id) {
    const project = await prisma.project.findFirst({
      where: { userId: session.user.id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (project) {
      redirect(`/project/${project.id}`);
    }
    // No projects - redirect to empty project creation flow
    redirect('/projects/new');
  }

  // Guest user flow
  const cookieStore = await cookies();
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
