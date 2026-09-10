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
}

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
            for (const modeCookie of cookies)
              expect(['stack', 'knowledge', 'review']).toContain(
                resolveProjectMode({ hasContext, hasStrategy, reviewSeen, evidenceParam, modeCookie })
              )
  })
})
