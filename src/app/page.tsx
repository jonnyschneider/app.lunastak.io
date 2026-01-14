import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { HomePage } from '@/components/HomePage';
import { prisma } from '@/lib/db';
import { isGuestUser } from '@/lib/projects';

const GUEST_COOKIE_NAME = 'guestUserId';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;

  // Don't redirect if URL has params indicating intentional navigation
  if (params.question || params.deepDiveId || params.projectId || params.stub) {
    return <HomePage session={session} />;
  }

  if (session?.user?.id) {
    // Authenticated user - redirect to their first project
    const project = await prisma.project.findFirst({
      where: { userId: session.user.id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (project) {
      redirect(`/project/${project.id}`);
    }
    // No projects - show empty state via HomePage
    return <HomePage session={session} />;
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
  // (cookies can only be set in Route Handlers, not Server Components)
  redirect('/api/guest/init');
}
