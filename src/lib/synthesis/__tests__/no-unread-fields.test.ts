/**
 * Ratchet: synthesis must not ask for, parse, or persist fields nothing reads.
 *
 * `keyQuotes`, `contradictions` and `subdimensions` were produced by every
 * synthesis call and read by nothing — 26.5% of the stage's output tokens,
 * measured across the 2026-08-26 capture set. `contradictions` was additionally
 * being destroyed and regenerated on every incremental update, because the
 * prompt asked for "existing + new" while the payload never supplied the
 * existing ones.
 *
 * `keyThemes` was read — but only by the incremental path, which is ~13% of
 * synthesis runs, while the field was produced on 100% of them. A 10-dimension
 * A/B on real capture data (2026-08-29) measured continuity against the prior
 * summary at 98% with it and 98% without, gaps 68 vs 70, and 10% fewer output
 * tokens without it. `summary` is doing the continuity work.
 *
 * If a consumer is ever built for one of these, delete its entry here first —
 * that forces the field back through review rather than reappearing by drift.
 */
import { describe, it, expect } from 'vitest'
import { FULL_SYNTHESIS_SYSTEM } from '@/lib/prompts/stages/full-synthesis'
import { INCREMENTAL_SYNTHESIS_SYSTEM } from '@/lib/prompts/stages/incremental-synthesis'
import * as fs from 'fs'
import * as path from 'path'

const UNREAD = ['keyQuotes', 'contradictions', 'subdimensions', 'keyThemes'] as const

const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

describe('synthesis asks only for fields something reads', () => {
  it.each(UNREAD)('the full-synthesis prompt does not request %s', (field) => {
    expect(FULL_SYNTHESIS_SYSTEM).not.toContain(field)
  })

  it.each(UNREAD)('the incremental-synthesis prompt does not request %s', (field) => {
    expect(INCREMENTAL_SYNTHESIS_SYSTEM).not.toContain(field)
  })

  it('the full-synthesis prompt still requests what IS read', () => {
    for (const field of ['summary', 'gaps', 'confidence']) {
      expect(FULL_SYNTHESIS_SYSTEM).toContain(field)
    }
  })

  it.each(UNREAD)('SynthesisResult does not carry %s', (field) => {
    expect(read('synthesis/types.ts')).not.toContain(field)
  })

  it.each(UNREAD)('nothing in synthesis/ persists %s', (field) => {
    const dir = path.join(SRC, 'synthesis')
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes(field))
    expect(offenders).toEqual([])
  })

  it('project bootstrap does not seed the unread columns', () => {
    const src = read('projects.ts')
    for (const field of UNREAD) expect(src).not.toContain(field)
  })
})
