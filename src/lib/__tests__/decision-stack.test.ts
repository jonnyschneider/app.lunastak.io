import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    decisionStack: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    decisionStackComponent: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    decisionStackSnapshot: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      decisionStack: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
      decisionStackComponent: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), upsert: vi.fn() },
      decisionStackSnapshot: { findFirst: vi.fn(), create: vi.fn() },
    })),
  },
}))

import { assembleStrategyStatements } from '../decision-stack'
import type { StrategyStatements } from '../types'

describe('assembleStrategyStatements', () => {
  it('assembles from DecisionStack + components into StrategyStatements', () => {
    const stack = {
      id: 'ds-1',
      projectId: 'proj-1',
      vision: 'Test vision',
      visionElaboration: 'Vision detail',
      strategy: 'Test strategy',
      strategyElaboration: 'Strategy detail',
      components: [
        { componentType: 'objective', componentId: 'obj-1', content: { id: 'obj-1', title: 'Obj 1', explanation: 'Explain' }, sortOrder: 0, status: 'active' },
        { componentType: 'opportunity', componentId: 'opp-1', content: { id: 'opp-1', title: 'Opp 1', description: 'Desc', objectiveIds: ['obj-1'] }, sortOrder: 0, status: 'active' },
        { componentType: 'principle', componentId: 'prin-1', content: { id: 'prin-1', priority: 'Quality', deprioritized: 'Speed' }, sortOrder: 0, status: 'active' },
      ],
    }

    const result = assembleStrategyStatements(stack as any)

    expect(result.vision).toBe('Test vision')
    expect(result.visionExplainer).toBe('Vision detail')
    expect(result.strategy).toBe('Test strategy')
    expect(result.strategyExplainer).toBe('Strategy detail')
    expect(result.objectives).toHaveLength(1)
    expect(result.objectives[0].title).toBe('Obj 1')
    expect(result.opportunities).toHaveLength(1)
    expect(result.opportunities[0].title).toBe('Opp 1')
    expect(result.principles).toHaveLength(1)
    expect(result.principles[0].priority).toBe('Quality')
  })

  it('returns empty arrays when no components exist', () => {
    const stack = {
      id: 'ds-1',
      projectId: 'proj-1',
      vision: '',
      visionElaboration: null,
      strategy: '',
      strategyElaboration: null,
      components: [],
    }

    const result = assembleStrategyStatements(stack as any)
    expect(result.objectives).toEqual([])
    expect(result.opportunities).toEqual([])
    expect(result.principles).toEqual([])
  })

  it('filters out archived components', () => {
    const stack = {
      id: 'ds-1',
      projectId: 'proj-1',
      vision: 'V',
      visionElaboration: null,
      strategy: 'S',
      strategyElaboration: null,
      components: [
        { componentType: 'objective', componentId: 'obj-1', content: { id: 'obj-1', title: 'Active', explanation: 'Yes' }, sortOrder: 0, status: 'active' },
        { componentType: 'objective', componentId: 'obj-2', content: { id: 'obj-2', title: 'Archived', explanation: 'No' }, sortOrder: 1, status: 'archived' },
      ],
    }

    const result = assembleStrategyStatements(stack as any)
    expect(result.objectives).toHaveLength(1)
    expect(result.objectives[0].title).toBe('Active')
  })

  it('sorts components by sortOrder', () => {
    const stack = {
      id: 'ds-1',
      projectId: 'proj-1',
      vision: 'V',
      visionElaboration: null,
      strategy: 'S',
      strategyElaboration: null,
      components: [
        { componentType: 'objective', componentId: 'obj-2', content: { id: 'obj-2', title: 'Second', explanation: 'B' }, sortOrder: 1, status: 'active' },
        { componentType: 'objective', componentId: 'obj-1', content: { id: 'obj-1', title: 'First', explanation: 'A' }, sortOrder: 0, status: 'active' },
      ],
    }

    const result = assembleStrategyStatements(stack as any)
    expect(result.objectives[0].title).toBe('First')
    expect(result.objectives[1].title).toBe('Second')
  })
})
