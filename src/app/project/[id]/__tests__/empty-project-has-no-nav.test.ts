/**
 * Enforcement test: an empty project is given NO header navigation at all.
 *
 * ⚠ WHY THIS IS A SOURCE TEST AND NOT A RENDER TEST. The invariant does not live in a component —
 * it lives in the CALLER. `ProjectTabNav` is a pure component and its own tests cover what it
 * renders; the thing that breaks is `page.tsx` deciding whether to inject it at all. Rendering
 * `ProjectPage` to assert that would mean standing up a 1,700-line client component with its fetch,
 * session, Statsig and background-task wiring, to observe one call on a context setter. The repo
 * already uses source inspection for invariants of this shape — see `claude-wrapper.test.ts`.
 *
 * WHAT BREAKS IF THIS GOES. Both halves of the toggle used to show the same three onboarding cards,
 * so the control offered a choice between one screen and a subset of itself (removed 2026-09-10).
 * Returning `null` from `ProjectTabNav` would NOT be an equivalent fix: `setTabNav` would still hold
 * a non-null node, so the header's mobile row keeps its border and the desktop row its gap. "Renders
 * nothing" and "is not injected" are different things.
 *
 * AND THIS EXACT LINE HAS ALREADY CARRIED A BUG. `hasContext` was missing from the effect's
 * dependency array, latent only because two coincidences re-ran the effect anyway — one of which
 * slice 2 removes by turning the first-context landing into a redirect. Without it: cold-start
 * project, user starts a chat, `conversationCount` 0→1 while `fragmentCount` stays 0, nothing in the
 * array moves, and the user sits on a mode-less page with no route to the knowledgebase.
 *
 * The docblock on `ProjectTabNav` says "see the test file" for this claim. This is that file.
 */

import * as fs from 'fs'
import * as path from 'path'

/** The client component. It moved out of `page.tsx` when the route became a server redirector. */
const PAGE = path.join(__dirname, '../ProjectClient.tsx')

describe('the ground-truth review is per ingest, and reached by address', () => {
  const source = fs.readFileSync(PAGE, 'utf-8')

  /*
   * ⚠ THE MODEL CHANGED 2026-09-10, AFTER THE OLD ONE REACHED PROD IN 2.8.0.
   *
   * It was "one first look per project", with two entries: `?mode=review`, and `?mode=knowledge`
   * yielding to a first look still pending. On prod that failed twice over:
   *
   *   1. An uploaded document never offered its review. The landing that used to move a user there
   *      had been relocated to the server table, which only runs on a bare URL — and an in-session
   *      ingest never makes that request. The user got the pre-strategy signpost instead.
   *   2. A bundle imported 26 seconds after deferring the document's review landed on the dashboard,
   *      because the deferral was keyed on the project and so silenced every later ingest too.
   *
   * These pin the replacement, so a later refactor cannot quietly restore either.
   */
  it('renders the review on ?mode=review, and only there', () => {
    expect(source).toMatch(/const showReview = canReview && mode === 'review'/)
  })

  it('no longer lets the dashboard yield to a pending review — that was the per-project model', () => {
    expect(source).not.toContain('reviewSeenLoaded && !reviewSeen')
  })

  it('never turns the review into a client redirect gated on a dismissal read', () => {
    // If this ever fails, read the design doc §8 before "fixing" it. It is the rejected design.
    expect(source).not.toMatch(/if \(!reviewSeen\)[^\n]*router\.(replace|push)/)
  })

  it('presents the review when a DOCUMENT finishes in session — the half 2.8.0 was missing', () => {
    expect(source).toMatch(/presentIngestReview\('document', documentId/)
  })

  it('presents the review when a BUNDLE import closes — "Show me" used to only close the dialog', () => {
    expect(source).toMatch(/presentIngestReview\('bundle', result\.importBatchId\)/)
  })

  it('presents the review when a CHAT finishes — both extraction branches report through one callback', () => {
    // A chat's 6 ground truths reached preview with a toast and no review. The first chat on a
    // project is a `generation` task whose completion event names no conversation, so the event
    // route cannot cover it; the sheet reports its own completion instead.
    expect(source).toMatch(/presentIngestReview\('conversation', conversationId/)
    const chat = fs.readFileSync(path.join(__dirname, '../../../../components/chat-sheet.tsx'), 'utf-8')
    expect(chat.match(/onComplete: \(\) => reportIngest\(/g)?.length, 'both branches must report').toBe(2)
    expect(chat).not.toContain("'New insights added'")
  })

  it('reviews a DEEP-DIVE ingest first, then hands the user back to the deep dive', () => {
    /*
     * For about an hour a deep-dive ingest skipped the review and reopened the deep dive — which hid
     * what it produced almost completely, since the deep-dive sheet shows no ground truths. Jonny:
     * "if they're not reviewed on upload, when would they be shown to the user?"
     *
     * Now: the review first, carrying the deep dive; "Review these later" hands back to it.
     */
    expect(source).toMatch(/presentIngestReview\('document', documentId, deepDiveId\)/)
    expect(source).toMatch(/presentIngestReview\('conversation', conversationId, deepDiveId\)/)
    expect(source).toMatch(/setMode\('review', \{ batch: reviewBatchKey\(source, id\), deepDive: deepDiveId \}\)/)
    // …and the defer path reopens it.
    expect(source).toMatch(/setMode\('knowledge'\)\s*\n[\s\S]{0,160}if \(reviewDeepDive\) \{\s*\n\s*setSelectedDeepDiveId\(reviewDeepDive\)/)
  })

  it('after a strategy exists, a deep-dive ingest still goes straight back to its deep dive', () => {
    // There is no review post-strategy (it is first-contact framed) — so the deep dive is the answer.
    expect(source).toMatch(/if \(hasStrategyRef\.current \|\| projectData\?\.isDemo === true\) \{\s*\n\s*if \(deepDiveId\) \{\s*\n\s*setSelectedDeepDiveId\(deepDiveId\)/)
  })

  it('records a deferral against the ingest, not the project, then leaves the review address', () => {
    expect(source).toMatch(/if \(reviewBatch\) deferReview\(reviewBatch\)\s*\n\s*setMode\('knowledge'\)/)
    expect(source).not.toMatch(/useDismissed\(projectId, GROUND_TRUTH_REVIEW_ITEM_TYPE, projectId\)/)
  })

  it('keeps the demo exclusion — a demo\'s ground truths are not the visitor\'s to review', () => {
    expect(source).toMatch(/const canReview =\s*\n?\s*projectData\?\.isDemo !== true/)
  })
})

describe('the empty project is given no nav', () => {
  const source = fs.readFileSync(PAGE, 'utf-8')

  /** The dependency array of the effect that injects the header nav — identified by `setTabNav`. */
  function headerEffectDeps(): string {
    const match = source.match(/\}, \[([^\]]*setTabNav[^\]]*)\]\)/)
    if (!match) throw new Error('could not find the header effect dependency array')
    return match[1]
  }

  it('guards the header effect on `!hasContext` and injects null', () => {
    expect(source).toMatch(/if \(!hasContext\) \{\s*setTabNav\(null\)\s*return\s*\}/)
  })

  it('does that BEFORE any nav is injected — an early return, not a branch after the fact', () => {
    const guard = source.search(/if \(!hasContext\) \{\s*setTabNav\(null\)/)
    const injection = source.indexOf('setTabNav(\n      <ProjectTabNav')
    expect(guard).toBeGreaterThan(-1)
    expect(injection).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(injection)
  })

  it('lists `hasContext` in the effect dependency array that reads it', () => {
    // Order-independent on purpose: the invariant is that the value is PRESENT, not where it sits.
    expect(headerEffectDeps(), 'the header effect must depend on hasContext — see the docblock above it')
      .toContain('hasContext')
  })

  it('renders the cold start for an empty project WHATEVER the URL asks for', () => {
    /*
     * The second half of the same invariant, and it is new with the `?mode=` work.
     *
     * The server only consults the landing table when `?mode` is ABSENT — deliberately, because that
     * read would otherwise fire a database round-trip on every toggle. So `?mode=knowledge` on an
     * empty project reaches the client unchallenged, and the client has to hold rule 1 itself or the
     * knowledgebase renders empty: the exact state whose empty-state branch was DELETED on
     * 2026-09-10 on the grounds that it was unreachable by construction.
     */
    expect(source).toMatch(/!hasContext \|\| mode === 'stack' \? 'decision-stack' : 'knowledgebase'/)
  })

  it('keeps the raw fragmentCount in that array, with no `?? 0`', () => {
    /*
     * `undefined → 0` when the project fetch lands is what re-runs the effect on load. Coalescing it
     * to 0 makes the value constant across that transition, and an empty project would hold a toggle
     * forever. The PROP of the same name does coalesce — the two are deliberately different.
     */
    expect(headerEffectDeps()).toContain('projectData?.stats?.fragmentCount')
    expect(headerEffectDeps()).not.toContain('projectData?.stats?.fragmentCount ?? 0')
  })
})
