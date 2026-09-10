import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';
import { LAST_PROJECT_COOKIE_NAME, readLastProjectCookie } from '@/lib/navigation/last-project-cookie';

const GUEST_COOKIE_NAME = 'guestUserId';

/**
 * Root page - always redirects to a project page
 * Nobody sees a "homepage" - all users land on their project
 *
 * WHICH project is the `lunastak_last_project` cookie's job. Before it, this always picked the
 * OLDEST (`createdAt: 'asc'`), so anything that navigated here — closing a demo, most visibly —
 * reset you to a project you may not have opened in weeks. The cookie is a hint only: it is looked
 * up scoped to the current user, and a stale, foreign or missing value falls straight through to
 * the oldest-project behaviour that was here before.
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

  const lastProjectId = readLastProjectCookie(cookieStore.get(LAST_PROJECT_COOKIE_NAME)?.value);

  /** The remembered project if it is still this user's and still active; otherwise their oldest. */
  async function pickProject(userId: string) {
    if (lastProjectId) {
      const remembered = await prisma.project.findFirst({
        where: { id: lastProjectId, userId, status: 'active' },
        select: { id: true },
      });
      if (remembered) return remembered;
    }
    return prisma.project.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }

  // Authenticated user - redirect to the project they were last in, else their first
  if (session?.user?.id) {
    let project = await pickProject(session.user.id);

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
      const project = await pickProject(guestUserIdCookie.value);

      if (project) {
        redirect(`/project/${project.id}`);
      }
    }
    // Invalid cookie or no project - fall through to create new guest
  }

  // Redirect to API route that creates guest and sets cookie
  redirect('/api/guest/init');
}
