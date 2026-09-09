/**
 * @jest-environment node
 *
 * Tests for GET /api/project/[id]/fragments.
 *
 * This endpoint already serves FragmentExplorer in production, so the existing shape is
 * load-bearing: the ground-truth fields (evidence, interpretationType, reviewedAt) are
 * additive and everything else must pass through untouched.
 *
 * The payload is deliberately data-shaped, not screen-shaped: no tranches, bands, scores
 * or grouping, no filtering of fragments without evidence or with failed verification, and
 * no flattening of evidence to a single "best" span. The client composes.
 *
 * Follows the codebase convention for API tests (see ../../__tests__/route.test.ts):
 * lightweight contract-style tests with the prisma + cookie + auth collaborators mocked.
 */

import { GET, PATCH } from '../route'
import type { NextRequest } from 'next/server'

const mockFindFirstProject = vi.fn()
const mockFindUniqueUser = vi.fn()
const mockFragmentFindMany = vi.fn()
const mockFragmentCount = vi.fn()
const mockFragmentUpdateMany = vi.fn()
const mockCookieGet = vi.fn()
const mockGetServerSession = vi.fn()
const mockIsGuestUser = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mockCookieGet })),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => mockFindFirstProject(...args) },
    user: { findUnique: (...args: unknown[]) => mockFindUniqueUser(...args) },
    fragment: {
      findMany: (...args: unknown[]) => mockFragmentFindMany(...args),
      count: (...args: unknown[]) => mockFragmentCount(...args),
      updateMany: (...args: unknown[]) => mockFragmentUpdateMany(...args),
    },
  },
}))

vi.mock('@/lib/projects', () => ({
  isGuestUser: (...args: unknown[]) => mockIsGuestUser(...args),
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
  mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })
  mockCookieGet.mockReturnValue(undefined)
  mockFindFirstProject.mockResolvedValue({ id: 'p1' })
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
  it('returns the shipped FragmentExplorer fields alongside the new ones', async () => {
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
    mockGetServerSession.mockResolvedValue(null)

    const res = await GET(req(), makeParams('p1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when the project is not accessible', async () => {
    mockFindFirstProject.mockResolvedValue(null)

    const res = await GET(req(), makeParams('p1'))

    expect(res.status).toBe(404)
  })
})
