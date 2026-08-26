/**
 * The shipped per-stage model map (Phase 4 ruling, 2026-08-26).
 *
 * Decision record: Drive 05-Initiatives/Lunastak/Test-Data/20260826-model-upgrade/decision.md
 *
 * Opus 5 @ effort:low earns its cost on intricate knowledge work (vision/strategy and
 * opportunity generation). Everything else — extraction, tagging, and prose from
 * already-structured data — runs on Sonnet 5. Projected 1.49x prior cost and lower latency.
 *
 * The env overrides remain, and remain first: they are how the next forced model migration gets
 * tested without a code change, and how any arm of the experiment can be reproduced.
 */

import { modelFor, effortFor, DEFAULT_MODEL, STAGE_MODELS } from '@/lib/model-config'

describe('shipped stage map', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved }; vi.unstubAllEnvs() })
  beforeEach(() => {
    delete process.env.LUNASTAK_MODEL
    delete process.env.LUNASTAK_EFFORT
    delete process.env.LUNASTAK_MODEL_STRATEGY_GENERATION
  })

  it('routes the judgement-heavy stages to Opus 5', () => {
    expect(modelFor('strategy_generation')).toBe('claude-opus-5')
    expect(modelFor('refresh_strategy_generation')).toBe('claude-opus-5')
    expect(modelFor('opportunity_generation')).toBe('claude-opus-5')
  })

  it('runs those Opus stages at LOW effort — where the cost saving comes from', () => {
    expect(effortFor(modelFor('strategy_generation'), 'strategy_generation')).toBe('low')
    expect(effortFor(modelFor('opportunity_generation'), 'opportunity_generation')).toBe('low')
  })

  it('routes mechanical stages to Sonnet 5', () => {
    for (const stage of ['extraction', 'document_extraction', 'dimensional_analysis',
                         'import_dimension_tagging', 'knowledge_summary', 'conversation_title',
                         'suggest_opposite', 'continue_questioning']) {
      expect(modelFor(stage)).toBe('claude-sonnet-5')
    }
  })

  it('leaves full_synthesis on Sonnet 5 — the open fork, defaulted not decided', () => {
    // 21 calls and the largest single cost line. Moving it to Opus-low takes the map
    // from 1.49x to 2.14x. Flip deliberately or not at all.
    expect(modelFor('full_synthesis')).toBe('claude-sonnet-5')
  })

  it('sets no effort for the Sonnet stages', () => {
    expect(effortFor(modelFor('extraction'), 'extraction')).toBeUndefined()
  })

  it('defaults an unknown stage to Sonnet 5 rather than the retired incumbent', () => {
    expect(modelFor('some_new_stage')).toBe(DEFAULT_MODEL)
    expect(DEFAULT_MODEL).toBe('claude-sonnet-5')
  })

  it('lets a per-context env override beat the map — the migration escape hatch', () => {
    process.env.LUNASTAK_MODEL_STRATEGY_GENERATION = 'claude-opus-4-8'
    expect(modelFor('strategy_generation')).toBe('claude-opus-4-8')
  })

  it('lets a global env override reproduce any experiment arm', () => {
    process.env.LUNASTAK_MODEL = 'claude-sonnet-4-5-20250929'
    expect(modelFor('strategy_generation')).toBe('claude-sonnet-4-5-20250929')
    expect(modelFor('extraction')).toBe('claude-sonnet-4-5-20250929')
  })

  it('exposes the map so cost can be re-derived without reading code', () => {
    expect(Object.keys(STAGE_MODELS).sort()).toEqual(
      ['opportunity_generation', 'refresh_strategy_generation', 'strategy_generation'])
  })
})
