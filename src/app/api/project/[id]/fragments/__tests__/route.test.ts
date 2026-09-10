/**
 * @jest-environment node
 *
 * Tests for GET /api/project/[id]/fragments.
 *
 * The shape here is load-bearing: the ground-truth fields (evidence, interpretationType,
 * reviewedAt) are additive and everything else must pass through untouched.
 *
 * It was written when `FragmentExplorer` was the consumer. That component was deleted on
 * 2026-09-10 — it was a second, older interface onto the same list, shown only to demo
 * visitors — and `GroundTruthReview` is now the only client. The assertions below stay as
 * they are: they pin the response contract, not any one component's use of it, and the
 * fields are still the ones being returned.
 *
 * The payload is deliberately data-shaped, not screen-shaped: no tranches, bands, scores
 * or grouping, no filtering of fragments without evidence or with failed verification, and
 * no flattening of evidence to a single "best" span. The client composes.
 *
 * Follows the codebase convention for API tests (see ../../__tests__/route.test.ts):
 * lightweight contract-style tests with prisma and the requester (`getRequester`) mocked. The
 * access check is the real guard, so `project.findFirst` is the guard's query.
 */

import { GET, PATCH } from '../route'
import type { NextRequest } from 'next/server'

const mockFindFirstProject = vi.fn()
const mockFragmentFindMany = vi.fn()
const mockFragmentCount = vi.fn()
const mockFragmentUpdateMany = vi.fn()
const mockGetRequester = vi.fn()

vi.mock('@/lib/auth/current-user', () => ({
  getRequester: (...args: unknown[]) => mockGetRequester(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => mockFindFirstProject(...args) },
    fragment: {
      findMany: (...args: unknown[]) => mockFragmentFindMany(...args),
      count: (...args: unknown[]) => mockFragmentCount(...args),
      updateMany: (...args: unknown[]) => mockFragmentUpdateMany(...args),
    },
  },
}))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (qs = '') =>
  new Request(`http://localhost/api/project/p1/fragments${qs}`) as unknown as NextRequest

const capturedAt = new Date('2026-09-01T10:00:00.000Z')

/** A fragment row as prisma would return it, with the ground-truth fields defaulted. */
function fragmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'frag-1',
    title: 'A theme',
    content: 'theme content',
    contentType: 'theme',
    status: 'active',
    confidence: 'HIGH',
    sourceType: 'conversation',
    dimensionTags: [{ dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' }],
    conversationId: 'conv-1',
    conversation: { id: 'conv-1', title: 'Kickoff' },
    document: null,
    capturedAt,
    interpretationType: 'verbatim',
    reviewedAt: null,
    evidence: [],
    ...overrides,
  }
}

async function getJson(qs = '') {
  const res = await GET(req(qs), makeParams('p1'))
  return { res, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetRequester.mockResolvedValue({ userId: 'user-1', isGuest: false })
  mockFindFirstProject.mockResolvedValue({ id: 'p1', userId: 'user-1', isDemo: false, status: 'active' })
  mockFragmentCount.mockResolvedValue(0)
  mockFragmentFindMany.mockResolvedValue([])
  mockFragmentUpdateMany.mockResolvedValue({ count: 0 })
})

/**
 * `reviewedAt` shipped with the Evidence layer and nothing wrote it. It is what separates
 * *reviewed and kept* from *never seen* (design §5) — the one engagement state a fragment cannot
 * report for itself. It lives on this route rather than a second endpoint for the same reason a
 * drop IS an archive: one control for what happens to a fragment.
 */
describe('PATCH /api/project/[id]/fragments — marking reviewed', () => {
  const patch = (body: unknown) =>
    PATCH(
      new Request('http://localhost/api/project/p1/fragments', {
        method: 'PATCH', body: JSON.stringify(body),
      }) as unknown as NextRequest,
      makeParams('p1'),
    )

  it('stamps reviewedAt without touching status', async () => {
    mockFragmentUpdateMany.mockResolvedValue({ count: 2 })
    const res = await patch({ ids: ['a', 'b'], reviewed: true })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, reviewed: 2 })
    const [call] = mockFragmentUpdateMany.mock.calls[0]
    expect(call.data).toEqual({ reviewedAt: expect.any(Date) })
    expect(call.data).not.toHaveProperty('status')
    expect(call.where).toEqual({ id: { in: ['a', 'b'] }, projectId: 'p1' })
  })

  it('does not require a status, which archiving does', async () => {
    const res = await patch({ ids: ['a'], reviewed: true })
    expect(res.status).toBe(200)
  })

  it('still rejects an archive with an invalid status', async () => {
    const res = await patch({ ids: ['a'], status: 'nonsense' })
    expect(res.status).toBe(400)
  })

  it('rejects a review with no ids', async () => {
    const res = await patch({ reviewed: true })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/project/[id]/fragments — evidence', () => {
  it('returns evidence ordered by ordinal even when the rows arrive out of order', async () => {
    mockFragmentFindMany.mockResolvedValue([
      fragmentRow({
        evidence: [
          { text: 'third span', verification: 'failed', sourceRole: 'user', ordinal: 2 },
          { text: 'first span', verification: 'verified', sourceRole: 'document', ordinal: 0 },
          { text: 'second span', verification: 'unverifiable', sourceRole: 'bundle', ordinal: 1 },
        ],
      }),
    ])

    const { body } = await getJson()

    expect(body.fragments[0].evidence).toEqual([
      { text: 'first span', verification: 'verified', sourceRole: 'document', ordinal: 0 },
      { text: 'second span', verification: 'unverifiable', sourceRole: 'bundle', ordinal: 1 },
      { text: 'third span', verification: 'failed', sourceRole: 'user', ordinal: 2 },
    ])
  })

  it('asks the database for evidence in ordinal order too', async () => {
    await getJson()

    const args = mockFragmentFindMany.mock.calls[0][0]
    expect(args.include.evidence.orderBy).toEqual({ ordinal: 'asc' })
    expect(args.include.evidence.select).toEqual({
      text: true,
      verification: true,
      sourceRole: true,
      ordinal: true,
    })
  })

  it('returns an empty array — not null or undefined — for a fragment with no evidence', async () => {
    mockFragmentFindMany.mockResolvedValue([fragmentRow({ evidence: [] })])

    const { body } = await getJson()

    expect(body.fragments[0].evidence).toEqual([])
  })

  it('keeps fragments with no evidence and with failed verification — the client decides', async () => {
    mockFragmentFindMany.mockResolvedValue([
      fragmentRow({ id: 'no-evidence', evidence: [] }),
      fragmentRow({
        id: 'all-failed',
        evidence: [{ text: 'bad span', verification: 'failed', sourceRole: 'user', ordinal: 0 }],
      }),
    ])

    const { body } = await getJson()

    expect(body.fragments.map((f: { id: string }) => f.id)).toEqual(['no-evidence', 'all-failed'])
    expect(body.total).toBe(2)
  })

  it('passes interpretationType and reviewedAt through, including when null', async () => {
    mockFragmentFindMany.mockResolvedValue([
      fragmentRow({
        id: 'reviewed',
        interpretationType: 'interpretation',
        reviewedAt: new Date('2026-09-02T08:30:00.000Z'),
      }),
      fragmentRow({ id: 'unreviewed', interpretationType: null, reviewedAt: null }),
    ])

    const { body } = await getJson()

    expect(body.fragments[0].interpretationType).toBe('interpretation')
    expect(body.fragments[0].reviewedAt).toBe('2026-09-02T08:30:00.000Z')
    expect(body.fragments[1].interpretationType).toBeNull()
    expect(body.fragments[1].reviewedAt).toBeNull()
  })
})

describe('GET /api/project/[id]/fragments — existing shape is unchanged', () => {
  it('returns the long-shipped fields alongside the newer ground-truth ones', async () => {
    mockFragmentFindMany.mockResolvedValue([fragmentRow()])
    mockFragmentCount.mockResolvedValueOnce(7).mockResolvedValueOnce(3)

    const { body } = await getJson()

    expect(body).toEqual({
      fragments: [
        {
          id: 'frag-1',
          title: 'A theme',
          content: 'theme content',
          contentType: 'theme',
          status: 'active',
          confidence: 'HIGH',
          sourceType: 'conversation',
          dimensions: [{ dimension: 'CUSTOMER_MARKET', confidence: 'HIGH' }],
          // Added 2026-09-10 for the per-ingest review. A conversation is its own batch.
          reviewBatch: 'chat:conv-1',
          source: { type: 'conversation', id: 'conv-1', name: 'Kickoff' },
          capturedAt: capturedAt.toISOString(),
          interpretationType: 'verbatim',
          reviewedAt: null,
          evidence: [],
        },
      ],
      total: 1,
      activeCount: 7,
      archivedCount: 3,
    })
  })

  it('names the ingest each fragment arrived in, so the review can scope to it', async () => {
    /*
     * The per-ingest review (2026-09-10) filters on this. After an upload the user sees what was
     * drawn from THAT document; after an import, from that bundle's batch; after a chat, from it.
     */
    mockFragmentFindMany.mockResolvedValue([
      fragmentRow({ id: 'd', conversationId: null, conversation: null, documentId: 'doc-1', document: { id: 'doc-1', fileName: 'gtm.md' } }),
      fragmentRow({ id: 'b', conversationId: null, conversation: null, sourceType: 'import', importBatchId: 'batch-9' }),
      fragmentRow({ id: 'c' }),
      // An import with no batch id cannot be scoped — null, never a key built from `undefined`.
      fragmentRow({ id: 'x', conversationId: null, conversation: null, sourceType: 'import', importBatchId: null }),
    ])

    const { body } = await getJson()
    const byId = Object.fromEntries(body.fragments.map((f: { id: string; reviewBatch: string | null }) => [f.id, f.reviewBatch]))

    expect(byId).toEqual({ d: 'doc:doc-1', b: 'bundle:batch-9', c: 'chat:conv-1', x: null })
  })

  it('still resolves a document source and still honours the dimension filter', async () => {
    mockFragmentFindMany.mockResolvedValue([
      fragmentRow({ conversation: null, document: { id: 'doc-1', fileName: 'gtm.md' } }),
    ])

    const { body } = await getJson('?dimension=CUSTOMER_MARKET&status=all')

    expect(body.fragments[0].source).toEqual({
      type: 'document',
      id: 'doc-1',
      name: 'gtm.md',
    })
    const where = mockFragmentFindMany.mock.calls[0][0].where
    expect(where.dimensionTags).toEqual({ some: { dimension: 'CUSTOMER_MARKET' } })
    expect(where.status).toBeUndefined()
  })

  it('returns 401 when there is no session and no guest cookie', async () => {
    mockGetRequester.mockResolvedValue(null)

    const res = await GET(req(), makeParams('p1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the project is not accessible', async () => {
    mockFindFirstProject.mockResolvedValue(null)

    const res = await GET(req(), makeParams('p1'))

    expect(res.status).toBe(404)
  })
})

describe('/api/project/[id]/fragments — who may do what', () => {
  const patch = () =>
    PATCH(
      new Request('http://localhost/api/project/p1/fragments', {
        method: 'PATCH', body: JSON.stringify({ ids: ['a'], reviewed: true }),
      }) as unknown as NextRequest,
      makeParams('p1'),
    )
  const guardWhere = () => JSON.stringify(mockFindFirstProject.mock.calls[0][0].where)

  it('GET honours demo projects — a demo visitor can read its fragments', async () => {
    await GET(req(), makeParams('p1'))
    expect(guardWhere()).toContain('"isDemo":true')
  })

  it('PATCH is the owner’s alone — a demo project’s fragments are not writable', async () => {
    await patch()
    expect(guardWhere()).not.toContain('isDemo')
    expect(guardWhere()).toContain('"userId":"user-1"')
  })

  it('PATCH on a project that is not the caller’s → 404, and nothing is written', async () => {
    mockFindFirstProject.mockResolvedValue(null)
    expect((await patch()).status).toBe(404)
    expect(mockFragmentUpdateMany).not.toHaveBeenCalled()
  })

  it.each([
    ['GET', () => GET(req(), makeParams('p1'))],
    ['PATCH', patch],
  ])('%s on an archived project → 404', async (_m, call) => {
    mockFindFirstProject.mockResolvedValue({ id: 'p1', userId: 'user-1', isDemo: false, status: 'archived' })
    expect((await call()).status).toBe(404)
    expect(mockFragmentFindMany).not.toHaveBeenCalled()
    expect(mockFragmentUpdateMany).not.toHaveBeenCalled()
  })
})
