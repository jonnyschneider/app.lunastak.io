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

const PAGE = path.join(__dirname, '../page.tsx')

describe('the empty project is given no nav', () => {
  const source = fs.readFileSync(PAGE, 'utf-8')

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
    const deps = source.match(/\}, \[hasContext,[^\]]*setTabNav\]\)/)
    expect(deps, 'the header effect must depend on hasContext — see the docblock above it').not.toBeNull()
  })

  it('keeps the raw fragmentCount in that array, with no `?? 0`', () => {
    /*
     * `undefined → 0` when the project fetch lands is what re-runs the effect on load. Coalescing it
     * to 0 makes the value constant across that transition, and an empty project would hold a toggle
     * forever. The PROP of the same name does coalesce — the two are deliberately different.
     */
    const deps = source.match(/\}, \[hasContext,[^\]]*setTabNav\]\)/)?.[0] ?? ''
    expect(deps).toContain('projectData?.stats?.fragmentCount')
    expect(deps).not.toContain('projectData?.stats?.fragmentCount ?? 0')
  })
})
