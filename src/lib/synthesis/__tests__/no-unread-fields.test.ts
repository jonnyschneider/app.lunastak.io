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
 * If a consumer is ever built for one of these, delete its entry here first —
 * that forces the field back through review rather than reappearing by drift.
 */
import { describe, it, expect } from 'vitest'
import { FULL_SYNTHESIS_SYSTEM } from '@/lib/prompts/stages/full-synthesis'
import { INCREMENTAL_SYNTHESIS_SYSTEM } from '@/lib/prompts/stages/incremental-synthesis'
import * as fs from 'fs'
import * as path from 'path'

const UNREAD = ['keyQuotes', 'contradictions', 'subdimensions'] as const

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
    for (const field of ['summary', 'keyThemes', 'gaps', 'confidence']) {
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
