/**
 * Ratchet: the evidence heading is MEASURED wording and may not drift.
 *
 * §18 of the ground-truth preflight design ran three payload shapes on real material:
 * evidence as prose, `content` alone, and evidence MARKED as the user's own words. Marking
 * the same characters took echo of the user's actual language from 4.9% to 9.4% and inverted
 * a 4.7x-toward-our-own-claims ratio into 3.6x-toward-the-user. **It is the labelling that
 * does the work, not the extra text** — so this one string is the read-side of the whole
 * evidence feature.
 *
 * It had no protection at all: not in `LLM_POLICY`, not covered by
 * `prompt-language-guidance.test.ts`, no test file. An architecture review found it on
 * 2026-09-08 — the constant declared itself measured while sitting outside every mechanism
 * §50 built to keep measured wording from drifting silently.
 *
 * WHY NOT THE LLM_POLICY RATCHET. That one derives from the policy table on purpose, so a new
 * stage is covered the moment it is classified and there is no hand-list to go stale. This is
 * not a stage-level guidance constant — it is payload text shared by four stages, so it has no
 * row to hang off. One constant, pinned where it lives, is the honest alternative to widening
 * that table's meaning.
 */
import { describe, it, expect } from 'vitest'
import { HEADER, renderEvidence } from '@/lib/prompts/shared/evidence'

describe('evidence heading (measured — see §18)', () => {
  it('is exactly the measured wording', () => {
    expect(HEADER).toBe("The user's own words this rests on:")
  })

  it('marks the spans as the user\'s own — the labelling is the mechanism', () => {
    const out = renderEvidence({ evidence: [{ text: 'we ship on Fridays', verification: 'verified' }] })
    expect(out).toContain(HEADER)
    expect(out).toContain('> we ship on Fridays')
  })
})

describe('renderEvidence', () => {
  it('returns empty for a fragment with no evidence — byte-identical to the pre-evidence payload', () => {
    expect(renderEvidence({ evidence: [] })).toBe('')
    expect(renderEvidence({ evidence: null })).toBe('')
    expect(renderEvidence({})).toBe('')
  })

  it('excludes failed spans — quoting one under this heading is a false attribution (§15)', () => {
    const out = renderEvidence({
      evidence: [
        { text: 'real quote', verification: 'verified' },
        { text: 'did not match', verification: 'failed' },
      ],
    })
    expect(out).toContain('real quote')
    expect(out).not.toContain('did not match')
  })

  it('returns empty when every span failed', () => {
    expect(renderEvidence({ evidence: [{ text: 'nope', verification: 'failed' }] })).toBe('')
  })

  it('renders verified and unverifiable identically — the distinction is bookkeeping for the badge', () => {
    const v = renderEvidence({ evidence: [{ text: 'same words', verification: 'verified' }] })
    const u = renderEvidence({ evidence: [{ text: 'same words', verification: 'unverifiable' }] })
    expect(v).toBe(u)
  })

  it('drops whitespace-only spans', () => {
    expect(renderEvidence({ evidence: [{ text: '   ', verification: 'verified' }] })).toBe('')
  })
})
