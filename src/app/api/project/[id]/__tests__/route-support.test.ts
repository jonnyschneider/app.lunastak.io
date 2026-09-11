/**
 * @jest-environment node
 *
 * GET /api/project/[id] — the computed support the Harvey ball reads (design §16.4).
 *
 * The route's job here is narrow: pull each dimension's active fragments with their evidence,
 * hand them to the pure calculator, and return the level. The banding itself is tested as a pure
 * function in `src/lib/support/__tests__/dimension-support.test.ts`.
 */

import { GET } from '../route'

const mockFindFirstProject = vi.fn()
const mockGetRequester = vi.fn()
const mockTraceFindMany = vi.fn()
const mockSynthesisFindMany = vi.fn()
const mockSnapshotFindFirst = vi.fn()
const mockSnapshotCount = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
}))

vi.mock('@/lib/auth/current-user', () => ({
  getRequester: (...args: unknown[]) => mockGetRequester(...args),
  GUEST_COOKIE_NAME: 'guestUserId',
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => mockFindFirstProject(...args) },
    trace: { findMany: (...args: unknown[]) => mockTraceFindMany(...args) },
    dimensionalSynthesis: { findMany: (...args: unknown[]) => mockSynthesisFindMany(...args) },
    decisionStackSnapshot: {
      findFirst: (...args: unknown[]) => mockSnapshotFindFirst(...args),
      count: (...args: unknown[]) => mockSnapshotCount(...args),
    },
  },
}))

vi.mock('@/lib/projects', () => ({
  createGuestUser: vi.fn(),
}))

vi.mock('@/lib/decision-stack', () => ({
  getDecisionStack: vi.fn(async () => null),
  assembleStrategyStatements: vi.fn(() => null),
}))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
const req = () => new Request('http://localhost/api/project/p1')

const DIM = 'CUSTOMER_MARKET'

/** One active fragment tagged to DIM, from conversation `c`, with one healthy verified span. */
const fragment = (c: string, over: Record<string, unknown> = {}) => ({
  id: `f-${Math.random()}`,
  conversationId: c,
  documentId: null,
  importBatchId: null,
  sourceType: 'extraction',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  dimensionTags: [{ dimension: DIM, confidence: 'MEDIUM' }],
  evidence: [{ text: 'a fully substantial verbatim span from the source', verification: 'verified' }],
  ...over,
})

function setup(fragments: unknown[]) {
  mockGetRequester.mockResolvedValue({ userId: 'u1', isGuest: false })
  // Answers both the guard's access query and the route's data query.
  mockFindFirstProject.mockResolvedValue({
    id: 'p1',
    userId: 'u1',
    status: 'active',
    name: 'P',
    isDemo: false,
    knowledgeSummary: null,
    knowledgeUpdatedAt: null,
    suggestedQuestions: [],
    conversations: [],
    fragments,
    documents: [],
    deepDives: [],
  })
  mockTraceFindMany.mockResolvedValue([])
  mockSynthesisFindMany.mockResolvedValue([])
  mockSnapshotFindFirst.mockResolvedValue(null)
  mockSnapshotCount.mockResolvedValue(0)
}

async function coverage(fragments: unknown[]) {
  setup(fragments)
  const res = await GET(req(), makeParams('p1'))
  expect(res.status).toBe(200)
  const body = await res.json()
  return body.stats.dimensionalCoverage
}

describe('GET /api/project/[id] — dimensional support', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a computed support level per dimension, and empty where there are no fragments', async () => {
    const c = await coverage([fragment('c1'), fragment('c1')])
    expect(c[DIM]).toEqual({ fragmentCount: 2, support: 'quarter' })
    expect(c.GO_TO_MARKET).toEqual({ fragmentCount: 0, support: 'empty' })
  })

  it('rises with distinct sources, not with the model self-report', async () => {
    const fragments = ['c1', 'c2', 'c3', 'c4', 'c5'].flatMap(c => [fragment(c), fragment(c)])
    const c = await coverage(fragments)
    expect(c[DIM].support).toBe('full')
  })

  it('no longer returns the dead averageConfidence', async () => {
    const c = await coverage([fragment('c1')])
    expect(c[DIM]).not.toHaveProperty('averageConfidence')
  })

  it('demotes one band when a majority of the dimension failed verification', async () => {
    const failed = { evidence: [{ text: 'a span that is not in the source at all', verification: 'failed' }] }
    const fragments = [
      ...['c1', 'c2', 'c3'].flatMap(c => [fragment(c, failed), fragment(c, failed)]),
      ...['c4', 'c5'].flatMap(c => [fragment(c), fragment(c)]),
    ]
    const c = await coverage(fragments)
    expect(c[DIM].support).toBe('three-quarter')
  })

  it('asks prisma for the evidence rows the calculator needs', async () => {
    await coverage([fragment('c1')])
    // The data query, not the guard's access check (which selects only id/owner/demo/status).
    const arg = mockFindFirstProject.mock.calls.map(([a]) => a).find(a => a.include)
    expect(arg.include.fragments.include).toHaveProperty('evidence')
  })
})
