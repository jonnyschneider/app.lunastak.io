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
import { pickPendingBatch, reviewBatchKey } from '@/lib/navigation/review-batch'
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

  const [counts, cookieStore] = await Promise.all([
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

  /*
   * ⚠ MATCHES THE API'S DEFINITION, which is `!!decisionStack && vision !== ''`
   * (`api/project/[id]/route.ts:266`) — NOT merely "a DecisionStack row exists". A row with an
   * empty vision is created before generation completes, so counting it would make the review rule
   * see a strategy that is not there yet and send a user past the review of what they just shared.
   */
  const hasStrategy = !!counts?.decisionStack && counts.decisionStack.vision !== ''

  /*
   * ═══ WHICH INGEST, IF ANY, IS STILL WAITING FOR ITS REVIEW? ═══
   *
   * Per ingest since 2026-09-10 (see `review-batch.ts` for why the per-project model failed on prod).
   * An ingest is a completed document with live ground truths, a bundle's import batch, or a chat that
   * produced ground truths. It is
   * pending until its own `ground_truth_review` row exists — which only "Review these later" writes.
   *
   * Only asked when it can matter: an authorised project (`counts` is null otherwise — rule 1 sends
   * that caller to the stack, and nothing about the project's ingests may reach the URL), with no
   * strategy yet (the review is framed for first contact). A second round-trip, but only here, on a
   * bare URL, pre-strategy — never on a toggle.
   *
   * `userId ?? ''` matches nothing, so an anonymous visitor has no deferrals, which is true. It never
   * matters in practice: the only projects an anonymous visitor can open are demos, and a demo has a
   * strategy.
   */
  let pendingBatch: string | null = null
  if (counts && !hasStrategy) {
    const [docs, bundles, chats, deferrals] = await Promise.all([
      prisma.document.findMany({
        where: { projectId: id, status: 'complete', fragments: { some: { status: 'active' } } },
        select: { id: true, createdAt: true },
      }),
      prisma.fragment.groupBy({
        by: ['importBatchId'],
        where: { projectId: id, sourceType: 'import', status: 'active', importBatchId: { not: null } },
        _max: { createdAt: true },
      }),
      prisma.conversation.findMany({
        where: { projectId: id, fragments: { some: { status: 'active' } } },
        select: { id: true, updatedAt: true },
      }),
      prisma.userDismissal.findMany({
        where: { userId: userId ?? '', projectId: id, itemType: GROUND_TRUTH_REVIEW_ITEM_TYPE },
        select: { itemKey: true },
      }),
    ])
    pendingBatch = pickPendingBatch(
      [
        ...docs.map((d) => ({ key: reviewBatchKey('document', d.id), at: d.createdAt })),
        // `updatedAt`: a chat is ingested when it ENDS, not when it starts.
        ...chats.map((c) => ({ key: reviewBatchKey('conversation', c.id), at: c.updatedAt })),
        ...bundles.flatMap((b) =>
          b.importBatchId && b._max.createdAt
            ? [{ key: reviewBatchKey('bundle', b.importBatchId), at: b._max.createdAt }]
            : []
        ),
      ],
      new Set(deferrals.map((d) => d.itemKey))
    )
  }

  const resolved = resolveProjectMode({
    hasContext,
    hasStrategy,
    hasPendingReview: pendingBatch !== null,
    evidenceParam: sp.evidence === '1',
    modeCookie: readModeCookieValue(cookieStore.get(MODE_COOKIE_NAME)?.value, id),
    /* A missing project reads as `false`, which is right: it lands on the stack via row 1 anyway. */
    isDemo: counts?.isDemo === true,
  })

  /*
   * `evidence` is CONSUMED here. It only ever meant "take me to what was extracted", and the mode it
   * was asking for is now in the URL properly — which retires the localStorage double-write it
   * needed to survive a `router.replace` remount.
   *
   * ⚠ `dimension` IS CARRIED THROUGH, BUT NOTHING READS IT. The legacy `/fragments` route and old links
   * still send it, and it is preserved so they do not lose it — but since `FragmentExplorer` was
   * deleted, `KnowledgeSummaryPanel`'s `selectedDimension` starts at `null` and has no URL input.
   * Guidance register row 5 ("some of this is thin" → `?mode=knowledge&dimension=<d>`) needs it
   * wired: an `initialDimension` prop beside `initialFilter`. (This comment claimed the panel still
   * filtered on it until 2026-09-11.)
   */
  const query = new URLSearchParams({ mode: resolved })
  if (typeof sp.dimension === 'string') query.set('dimension', sp.dimension)

  /*
   * `resolved === 'review'` IS the pending-ingest rule and nothing else: every other row returns a
   * stack or knowledge, and the preference cookie excludes `review` precisely because it is a moment
   * rather than a place to return to. `batch` scopes the review to the ingest that is waiting.
   *
   * ⚠ THE EVENT IS NOT LOGGED HERE. `<Link>` prefetches RSC payloads, which executes this component
   * — so a server-side log would count users who only hovered. The param hands it to the client,
   * which fires once on real arrival and strips it.
   */
  if (resolved === 'review' && pendingBatch) {
    query.set('batch', pendingBatch)
    query.set('landed', '1')
  }

  redirect(`/project/${id}?${query}`)
}
