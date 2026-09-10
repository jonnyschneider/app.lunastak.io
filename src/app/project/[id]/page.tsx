/**
 * The project route. A SERVER component, which is the whole point of it.
 *
 * Two jobs, and the split between them is load-bearing:
 *
 *   `?mode` present  → render the client. NO database work.
 *   `?mode` absent   → resolve where this user should land, and redirect there.
 *
 * ⚠ WHY THIS IS NOT A CLIENT REDIRECT. `ProjectClient` is `'use client'` and derives everything from
 * a client fetch, so deciding the mode there means land → fetch → jump. Press back and you return to
 * the redirector, which sends you forward again: the user cannot leave the project. Resolving before
 * render is the only shape where the back button works.
 *
 * ⚠ THE STATE READ IS GUARDED BEHIND THE NO-MODE BRANCH FOR PERFORMANCE, NOT TIDINESS. A search-param
 * change re-executes this component. If the queries below ran unconditionally, every single toggle
 * between the stack and the knowledgebase would cost a database round-trip — reintroducing exactly
 * the spinner that choosing a search param over a route segment exists to prevent, from a direction
 * nobody would think to look. Do not hoist them.
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getUserId } from '@/lib/auth/current-user'
import { resolveProjectMode, type ProjectMode } from '@/lib/navigation/resolve-mode'
import { MODE_COOKIE_NAME, readModeCookieValue } from '@/lib/navigation/mode-cookie'
import ProjectClient from './ProjectClient'

const GROUND_TRUTH_REVIEW_ITEM_TYPE = 'ground_truth_review'

/** `?mode=banana` is not an error — it simply is not a mode, so the table decides instead. */
function parseMode(raw: string | string[] | undefined): ProjectMode | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'stack' || value === 'knowledge' || value === 'review' ? value : null
}

export default async function ProjectRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams

  const mode = parseMode(sp.mode)
  if (mode) return <ProjectClient projectId={id} mode={mode} />

  // ── From here down is the no-mode branch ONLY. Everything below hits the database. ──

  /*
   * ⚠ A NULL `userId` IS NOT AN ERROR HERE, and redirecting on it broke anonymous demo deep links.
   *
   * A visitor arriving cold from the marketing site has no session AND no guest cookie, so
   * `getUserId()` returns null — that is exactly the person a `/project/<demoId>` link is for. The
   * API mints them a guest inline for this case (`api/project/[id]/route.ts:46-67`), but this
   * redirect runs BEFORE the client mounts, so bouncing them to sign-in means that fallback never
   * gets to run. It does not reproduce from inside the app, because in-app demo links carry
   * `?mode=stack` and take the no-database branch above; only cold, in a clean browser.
   *
   * So: no auth gate. Authorisation stays exactly where it already was — in the API the client is
   * about to call, which returns 401 for a project that is neither yours nor a demo.
   */
  const userId = await getUserId()

  const [counts, reviewDismissal, cookieStore] = await Promise.all([
    /*
     * ⚠ SCOPED, not `findUnique({ where: { id } })`. An unscoped read would let any caller infer
     * another user's project state from where the redirect lands — a project with fragments and no
     * strategy sends you somewhere different from an empty one. No match resolves to "no context",
     * which is rule 1 and lands on the stack, telling an unauthorised caller nothing.
     */
    prisma.project.findFirst({
      where: {
        id,
        status: 'active',
        OR: [{ userId: userId ?? '' }, { isDemo: true }],
      },
      select: {
        isDemo: true,
        _count: { select: { fragments: true, conversations: true, documents: true } },
        decisionStack: { select: { vision: true } },
      },
    }),
    /* `userId ?? ''` matches nothing, so an anonymous visitor simply has no dismissals — which is
     * true, and is the answer that lets rule 3 be decided without knowing who they are. */
    prisma.userDismissal.findFirst({
      where: { userId: userId ?? '', projectId: id, itemType: GROUND_TRUTH_REVIEW_ITEM_TYPE },
      select: { id: true },
    }),
    cookies(),
  ])

  /*
   * ⚠ NOT the client's `projectData === null ? true` ternary. That exists because the CLIENT cannot
   * know yet and flashing the cold start at a full project is worse than a late toggle. The server
   * knows before render, so there is no unknown state to be generous about — port the counts.
   *
   * A missing project resolves to "no context", which lands on the stack; the client renders its own
   * not-found from the same fetch it was going to do anyway.
   */
  const hasContext =
    (counts?._count.fragments ?? 0) > 0 ||
    (counts?._count.conversations ?? 0) > 0 ||
    (counts?._count.documents ?? 0) > 0

  const resolved = resolveProjectMode({
    hasContext,
    /*
     * ⚠ MATCHES THE API'S DEFINITION, which is `!!decisionStack && vision !== ''`
     * (`api/project/[id]/route.ts:266`) — NOT merely "a DecisionStack row exists". A row with an
     * empty vision is created before generation completes, so counting it would make row 3 see a
     * strategy that is not there yet and send a user past their first look.
     */
    hasStrategy: !!counts?.decisionStack && counts.decisionStack.vision !== '',
    reviewSeen: !!reviewDismissal,
    evidenceParam: sp.evidence === '1',
    modeCookie: readModeCookieValue(cookieStore.get(MODE_COOKIE_NAME)?.value, id),
    /* A missing project reads as `false`, which is right: it lands on the stack via row 1 anyway. */
    isDemo: counts?.isDemo === true,
  })

  /*
   * `evidence` is CONSUMED here. It only ever meant "take me to what was extracted", and the mode it
   * was asking for is now in the URL properly — which retires the localStorage double-write it
   * needed to survive a `router.replace` remount. `dimension` survives: the panel still filters on
   * it, and it is a different question.
   */
  const query = new URLSearchParams({ mode: resolved })
  if (typeof sp.dimension === 'string') query.set('dimension', sp.dimension)

  /*
   * `resolved === 'review'` IS row 3 — the first-context landing — and nothing else: rows 1, 2 and 5
   * return a stack or knowledge, and row 4 excludes `review` from the preference cookie precisely
   * because it is a moment rather than a place to return to.
   *
   * ⚠ THE EVENT IS NOT LOGGED HERE. `<Link>` prefetches RSC payloads, which executes this component
   * — so a server-side log would count users who only hovered. The param hands it to the client,
   * which fires once on real arrival and strips it.
   */
  if (resolved === 'review') query.set('landed', '1')

  redirect(`/project/${id}?${query}`)
}
