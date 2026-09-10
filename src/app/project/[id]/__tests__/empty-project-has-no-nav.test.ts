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

describe('the ground-truth review has two entries, with different rules', () => {
  const source = fs.readFileSync(PAGE, 'utf-8')

  /*
   * ⚠ THE ENTRY DECIDES; THE ROUTE ALWAYS RENDERS. These two rules look like one rule with an extra
   * clause, which is exactly how a later refactor collapses them — so they are pinned separately.
   *
   *   `?mode=review` is an ADDRESS. It must render the review whatever the dismissal says, or the
   *   address is a lie the first time guidance links a user back after they deferred.
   *
   *   `?mode=knowledge` is the DASHBOARD, which yields to a first look that has not happened. That
   *   half MUST stay gated on `reviewSeenLoaded`: `reviewSeen` comes from a client fetch, so without
   *   it the dashboard paints and is yanked away a round-trip later for users who already dismissed.
   *
   * And it is why the gate is a render branch and never a redirect — a redirect cannot be gated on
   * "the answer has arrived". It fires early or it fires visibly.
   */
  it('renders the review on ?mode=review regardless of dismissal', () => {
    expect(source).toMatch(/mode === 'review' \|\| \(reviewSeenLoaded && !reviewSeen\)/)
  })

  it('still gates the dashboard half on reviewSeenLoaded — the anti-flash guard', () => {
    expect(source).toContain('reviewSeenLoaded && !reviewSeen')
  })

  it('never turns that gate into a redirect', () => {
    // If this ever fails, read the design doc §8 before "fixing" it. It is the rejected design.
    expect(source).not.toMatch(/if \(!reviewSeen\)[^\n]*router\.(replace|push)/)
  })

  it('leaves the review address when the user defers, or the screen cannot dismiss itself', () => {
    expect(source).toMatch(/markReviewSeen\(\)[\s\S]{0,600}?if \(mode === 'review'\) setMode\('knowledge'\)/)
  })

  it('keeps the demo exclusion — a demo\'s ground truths are not the user\'s to review', () => {
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
