/**
 * Which mode does a bare `/project/[id]` land on?
 *
 * This replaces the four-writer precedence block that lived in `page.tsx` as effects racing over
 * component state. That block carried a hand-written precedence comment because the ordering had
 * ALREADY caused a bug on preview (2026-09-08): `router.replace` remounted the page before the
 * persist effect flushed, so the `evidence=1` handler had to write localStorage directly to be
 * believed.
 *
 * ⚠ THE PRECEDENCE RELOCATES, IT DOES NOT DISSOLVE (design §1). This is the same amount of
 * coordination logic. What changes is that it is one total function in one place that a test can
 * enumerate, instead of four effects whose interleaving is emergent — and that it runs on the server,
 * before render, so there is nothing to flash.
 */
import { resolveProjectMode, type ModeInputs } from '../resolve-mode'

/** Signed in, has context, nothing pending: the ordinary returning user. */
const base: ModeInputs = {
  hasContext: true,
  hasStrategy: false,
  reviewSeen: true,
  evidenceParam: false,
  modeCookie: null,
  isDemo: false,
}

/** A demo as it actually arrives: hydrated stack, so `hasStrategy` is true. */
const demo: ModeInputs = { ...base, isDemo: true, hasStrategy: true }

describe('resolveProjectMode', () => {
  it('row 1: an empty project goes to the stack, which is where the launchpad lives', () => {
    expect(resolveProjectMode({ ...base, hasContext: false })).toBe('stack')
  })

  it('row 1 outranks everything — a stored preference cannot strand an empty project', () => {
    /*
     * The old rule 1 FORCED the tab rather than defaulting it, so a legacy stored 'knowledgebase'
     * could not land a user on a branch that no longer exists. That is what makes deleting the
     * knowledgebase's empty state safe by construction rather than by argument.
     */
    expect(resolveProjectMode({ ...base, hasContext: false, modeCookie: 'knowledge', evidenceParam: true, reviewSeen: false }))
      .toBe('stack')
  })

  it('row 2: evidence=1 is an instruction from outside the app, and beats a preference', () => {
    expect(resolveProjectMode({ ...base, evidenceParam: true, modeCookie: 'stack' })).toBe('knowledge')
  })

  it('row 3: a pending first look lands on the review', () => {
    expect(resolveProjectMode({ ...base, reviewSeen: false })).toBe('review')
  })

  it('row 3 beats a stored preference — the first look is the one thing worth overriding it for', () => {
    expect(resolveProjectMode({ ...base, reviewSeen: false, modeCookie: 'stack' })).toBe('review')
  })

  it('row 3 requires !hasStrategy, or a user who built without reviewing is redirected forever', () => {
    expect(resolveProjectMode({ ...base, reviewSeen: false, hasStrategy: true })).toBe('stack')
  })

  it('row 4: the user\'s own preference, in both directions', () => {
    expect(resolveProjectMode({ ...base, modeCookie: 'knowledge' })).toBe('knowledge')
    expect(resolveProjectMode({ ...base, modeCookie: 'stack' })).toBe('stack')
  })

  it('row 4 ignores a junk cookie rather than trusting it', () => {
    // 'direction' is a real legacy value — the pre-2026-04 three-tab vocabulary.
    expect(resolveProjectMode({ ...base, modeCookie: 'direction' })).toBe('stack')
    expect(resolveProjectMode({ ...base, modeCookie: '' })).toBe('stack')
  })

  it('never lands anyone on `review` by preference — it is reachable only while one is pending', () => {
    expect(resolveProjectMode({ ...base, modeCookie: 'review' })).toBe('stack')
  })

  it('row 5: otherwise, the stack', () => {
    expect(resolveProjectMode(base)).toBe('stack')
  })

  it('is total — every combination of the five inputs resolves to a real mode', () => {
    const bools = [true, false]
    const cookies = [null, 'stack', 'knowledge', 'review', 'direction', '']
    for (const hasContext of bools)
      for (const hasStrategy of bools)
        for (const reviewSeen of bools)
          for (const evidenceParam of bools)
            for (const isDemo of bools)
              for (const modeCookie of cookies)
                expect(['stack', 'knowledge', 'review']).toContain(
                  resolveProjectMode({ hasContext, hasStrategy, reviewSeen, evidenceParam, modeCookie, isDemo })
                )
  })

  /**
   * ═══ ROW 3: A DEMO IS A SHOP WINDOW ═══
   *
   * Added 2026-09-10. A demo used to fall through to row 5 and re-open on whichever mode you last
   * looked at ON THAT DEMO — the mode cookie is a per-project map. Right for your own project,
   * wrong for an example: the tenth visitor should see what the first one saw, and what a demo
   * exists to show is the hydrated stack.
   */
  it('row 3: a demo lands on the stack', () => {
    expect(resolveProjectMode(demo)).toBe('stack')
  })

  it('row 3 beats a remembered preference for the knowledgebase', () => {
    expect(resolveProjectMode({ ...demo, modeCookie: 'knowledge' })).toBe('stack')
  })

  it('row 3 beats the first-look offer, even if a demo somehow had no strategy', () => {
    /*
     * Unreachable today — a demo carries a hydrated stack. Pinned so the demo case does not
     * silently depend on that staying true: a half-restored demo must still never open the walker
     * at a visitor who has nothing to review and no way to act on it.
     */
    expect(resolveProjectMode({ ...demo, hasStrategy: false, reviewSeen: false })).toBe('stack')
  })

  it('row 2 still outranks it: ?evidence=1 asks for the ground truths by name', () => {
    expect(resolveProjectMode({ ...demo, evidenceParam: true })).toBe('knowledge')
  })

  it('row 1 still outranks it: an empty demo has nothing to show', () => {
    expect(resolveProjectMode({ ...demo, hasContext: false })).toBe('stack')
  })

  it('a non-demo with the same inputs still honours the preference — the rule is about demos', () => {
    expect(resolveProjectMode({ ...demo, isDemo: false, modeCookie: 'knowledge' })).toBe('knowledge')
  })
})
