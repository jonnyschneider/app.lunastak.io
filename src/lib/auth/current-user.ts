/**
 * "Who is this request?" — the one definition.
 *
 * A signed-in session if there is one; otherwise the `guestUserId` cookie, **validated against the
 * database**. That validation is the part worth not losing: the cookie is just an id, so without
 * checking the row exists AND that its email is a guest email, any id in a cookie would be accepted
 * as that user.
 *
 * ⚠ EIGHT ROUTES HAD THEIR OWN COPY of this when it was extracted (2026-09-10) — dismissal,
 * deep-dive ×2, strategy, strategy-version, content, template-entry, conversation star. All eight
 * were behaviourally identical and differed only in style, which is luck rather than design: they
 * are the security boundary for every guest request in the product, and eight copies is eight places
 * for one of them to quietly stop validating.
 *
 * This module is where the navigation redirector reads from, so it is now also load-bearing for
 * which mode a user lands on. Repointing the remaining routes is tracked as a follow-up rather than
 * folded into a navigation change.
 */

import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

export const GUEST_COOKIE_NAME = 'guestUserId'

export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return session.user.id

  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
  if (!guestCookie?.value) return null

  // The cookie carries an id, not a proof. Confirm the row exists and is genuinely a guest before
  // trusting it — otherwise any id pasted into a cookie would be honoured.
  const guestUser = await prisma.user.findUnique({
    where: { id: guestCookie.value },
    select: { email: true },
  })
  if (guestUser && isGuestUser(guestUser.email)) return guestCookie.value

  return null
}
