import { describe, it, expect } from 'vitest'
import { parseKnowledgeFilter, knowledgeHref } from '../knowledge-filter'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

const params = (q: string) => new URLSearchParams(q)
const DIM = TIER_1_DIMENSIONS[0]

describe('parseKnowledgeFilter', () => {
  it('reads the changed-since diff', () => {
    expect(parseKnowledgeFilter(params('mode=knowledge&filter=changed'))).toEqual({ kind: 'changed' })
  })

  it('reads a Tier-1 dimension', () => {
    expect(parseKnowledgeFilter(params(`dimension=${DIM}`))).toEqual({ kind: 'dimension', dimension: DIM })
  })

  it('prefers changed when both arrive — one filter at a time', () => {
    expect(parseKnowledgeFilter(params(`filter=changed&dimension=${DIM}`))).toEqual({ kind: 'changed' })
  })

  it('ignores junk rather than opening an empty list', () => {
    expect(parseKnowledgeFilter(params('dimension=NOT_A_DIMENSION'))).toBeNull()
    expect(parseKnowledgeFilter(params('filter=banana'))).toBeNull()
    expect(parseKnowledgeFilter(params(''))).toBeNull()
  })
})

describe('knowledgeHref', () => {
  it('round-trips every filter through the parser', () => {
    for (const filter of [null, { kind: 'changed' as const }, { kind: 'dimension' as const, dimension: DIM }]) {
      const url = new URL(knowledgeHref('proj_1', filter), 'https://x.test')
      expect(url.pathname).toBe('/project/proj_1')
      expect(url.searchParams.get('mode')).toBe('knowledge')
      expect(parseKnowledgeFilter(url.searchParams)).toEqual(filter)
    }
  })
})
