/**
 * "Who is this request?" — the one definition.
 *
 * A signed-in session if there is one; otherwise the `guestUserId` cookie, **validated against the
 * database**. That validation is the part worth not losing: the cookie is just an id, so without
 * checking the row exists AND that its email is a guest email, any id in a cookie would be accepted
 * as that user.
 *
 * API routes don't call this directly: they go through `./guard.ts` (`requireUser`,
 * `require{Project,Conversation,Trace,Document}Access`), and `src/app/api/__tests__/route-auth.test.ts`
 * fails for any route that neither does that nor sits on its public allowlist — or that hand-rolls
 * its own copy of this function. History: when this was extracted (2026-09-10) eight routes had
 * their own copy, and ~17 by the 2026-09-11 count; all were moved onto the guard. Scattered copies
 * of the security boundary for every guest request are how one of them quietly stops validating.
 *
 * The navigation redirector also reads from this module, so it is load-bearing for which mode a
 * user lands on too.
 */

import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isGuestUser } from '@/lib/projects'

export const GUEST_COOKIE_NAME = 'guestUserId'

export interface Requester {
  userId: string
  /** True when identity came from the guest cookie rather than a NextAuth session. */
  isGuest: boolean
}

/**
 * The requester AND where the identity came from. The API guard (`./guard.ts`) needs the provenance
 * — some routes are for signed-up users only, and a bare id can't say whether it was a session or
 * a guest cookie.
 */
export async function getRequester(): Promise<Requester | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) return { userId: session.user.id, isGuest: false }

  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)
  if (!guestCookie?.value) return null

  // The cookie carries an id, not a proof. Confirm the row exists and is genuinely a guest before
  // trusting it — otherwise any id pasted into a cookie would be honoured.
  const guestUser = await prisma.user.findUnique({
    where: { id: guestCookie.value },
    select: { email: true },
  })
  if (guestUser && isGuestUser(guestUser.email)) return { userId: guestCookie.value, isGuest: true }

  return null
}

/** Just the id, for callers that don't care whether it's a guest. */
export async function getUserId(): Promise<string | null> {
  return (await getRequester())?.userId ?? null
}
