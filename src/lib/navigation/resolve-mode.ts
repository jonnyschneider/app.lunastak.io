/**
 * The landing-mode table for `/project/[id]`.
 *
 * ⚠ THIS IS THE FOUR-WRITER PRECEDENCE BLOCK, RELOCATED — not dissolved. It used to be four effects
 * in `page.tsx` racing over `activeTab`, with their order written down in a comment because getting
 * it wrong had already shipped a bug to preview. The difference is that this is one total function
 * the tests can enumerate, running on the server before anything renders.
 *
 * The demo row (3) was added 2026-09-10 and is the first rule that never existed as an effect — a
 * demo used to fall through to the remembered preference and re-open on whatever mode you last
 * looked at, which is right for your own project and wrong for an example. Adding a row here rather
 * than a special case at the call site is the point of the table: precedence stays in one readable
 * order, and the tests enumerate it.
 *
 * Every input is server-readable, which is the constraint the whole table is built to satisfy: the
 * redirect must happen before render, or the back button traps the user on a redirector that keeps
 * sending them forward again.
 */

export type ProjectMode = 'stack' | 'knowledge' | 'review'

/** The modes a user may ask for by hand. `review` is not one — it is only ever offered. */
const ADDRESSABLE_BY_PREFERENCE = ['stack', 'knowledge'] as const

export interface ModeInputs {
  /**
   * Any of the three ingest paths has landed. One-way by construction: there is no DELETE handler
   * for conversations or documents, and fragment discard is soft, so this never returns to false.
   */
  hasContext: boolean
  hasStrategy: boolean
  /**
   * The `ground_truth_review` row in `UserDismissal` — "has this user had their first look?".
   *
   * Deliberately NOT the old `project-<id>-landed-kb` localStorage latch, which answered the same
   * question per-device while being, by the design doc's own taxonomy, guidance state. This survives
   * a reload, works for guests via the `guestUserId` cookie, and is reassigned at signup by
   * `transfer-session.ts` — so the first look is not offered twice on a second device.
   */
  reviewSeen: boolean
  /** `?evidence=1` — "take me to what was extracted". Arrives from outside the app. */
  evidenceParam: boolean
  /** The per-device mode preference. Junk and legacy values are ignored, never trusted. */
  modeCookie: string | null
  /**
   * A demo project. It is a shop window, not a workspace — the thing it exists to show is the
   * hydrated stack, so that is where it opens every time.
   *
   * The knowledgebase stays reachable by the toggle; it is simply never the landing. Without this,
   * a demo falls through to row 4 and re-opens whichever mode you last looked at ON THAT DEMO,
   * which is right for your own project and wrong for an example someone is being shown.
   */
  isDemo: boolean
}

export function resolveProjectMode(i: ModeInputs): ProjectMode {
  // 1. An empty project has no toggle and only one thing to render — the launchpad, which lives on
  //    the stack. FORCED, not defaulted: a legacy stored 'knowledge' must not strand a user on a
  //    branch that no longer exists. This is what makes deleting the knowledgebase's empty state
  //    safe by construction.
  if (!i.hasContext) return 'stack'

  // 2. An explicit instruction from outside the app outranks anything we remember about the user.
  if (i.evidenceParam) return 'knowledge'

  // 3. A demo always opens on the stack. Rows 1 and 2 still outrank it: an empty demo has nothing
  //    to show, and `?evidence=1` is someone asking for the ground truths by name.
  //
  //    Placed ABOVE row 4 because that row is "what you last chose here", and a demo is not a
  //    workspace whose state anyone wants restored — it is an example, and it should look the same
  //    to the tenth visitor as to the first.
  //
  //    Placed above row 5 too, which is belt and braces: a demo carries a hydrated stack, so
  //    `hasStrategy` is true and the review can never be offered anyway. Stating it here means the
  //    demo case does not depend on that remaining true.
  if (i.isDemo) return 'stack'

  // 4. A first look that has not happened yet. `!hasStrategy` is load-bearing: without it, a user who
  //    built a strategy without ever reviewing would be sent here on every single visit, forever.
  if (!i.hasStrategy && !i.reviewSeen) return 'review'

  // 5. The user's own last choice. `review` is excluded on purpose — it is a moment, not a place to
  //    return to, and rows 1-4 are the only things that may offer it.
  if ((ADDRESSABLE_BY_PREFERENCE as readonly string[]).includes(i.modeCookie ?? '')) {
    return i.modeCookie as ProjectMode
  }

  // 6. Otherwise the stack, which is what a bare /project/[id] has always shown.
  return 'stack'
}
