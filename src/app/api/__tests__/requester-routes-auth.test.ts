// @vitest-environment node
/**
 * Routes that act on the requester's own things — pinned as they moved onto the guard (auth-gap
 * plan Task 11, "behaviour unchanged"). None had a route test before.
 */
import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  conversationFindFirst: vi.fn(),
  traceFindFirst: vi.fn(),
  traceUpdate: vi.fn(),
  dismissalUpsert: vi.fn(),
  dismissalFindMany: vi.fn(async () => []),
  dismissalDeleteMany: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { findFirst: mocks.conversationFindFirst },
    trace: { findFirst: mocks.traceFindFirst, update: mocks.traceUpdate },
    userDismissal: {
      upsert: mocks.dismissalUpsert,
      findMany: mocks.dismissalFindMany,
      deleteMany: mocks.dismissalDeleteMany,
    },
  },
}))

import { POST as star } from '../conversation/[id]/star/route'
import * as dismissal from '../dismissal/route'

const as = (userId: string | null, isGuest = false) =>
  mocks.getRequester.mockResolvedValue(userId ? { userId, isGuest } : null)

beforeEach(() => vi.clearAllMocks())

describe('POST conversation/[id]/star', () => {
  const call = () => star(new Request('http://x', { method: 'POST' }) as never, { params: Promise.resolve({ id: 'c1' }) })

  /** Conversation c1 is owned by `owner`, directly or through its project. */
  beforeEach(() => {
    mocks.conversationFindFirst.mockImplementation(async ({ where }: { where: unknown }) =>
      JSON.stringify(where).includes('"userId":"owner"') ? { id: 'c1', userId: 'owner', projectId: 'p1' } : null)
    mocks.traceFindFirst.mockResolvedValue({ id: 't1', starred: false })
  })

  it('anonymous → 401', async () => {
    as(null)
    expect((await call()).status).toBe(401)
    expect(mocks.conversationFindFirst).not.toHaveBeenCalled()
  })

  it('someone else’s conversation → 404 and nothing is starred', async () => {
    as('someone-else', true)
    expect((await call()).status).toBe(404)
    expect(mocks.traceUpdate).not.toHaveBeenCalled()
  })

  it('starring is a write — a demo project doesn’t open it', async () => {
    as('someone-else', true)
    await call()
    expect(JSON.stringify(mocks.conversationFindFirst.mock.calls[0][0].where)).not.toContain('isDemo')
  })

  it('the owner toggles the latest trace', async () => {
    as('owner', true)
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ starred: true })
    expect(mocks.traceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'c1' } }))
    expect(mocks.traceUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' } }))
  })

  it('no strategy yet → 400, as before', async () => {
    as('owner')
    mocks.traceFindFirst.mockResolvedValue(null)
    expect((await call()).status).toBe(400)
  })
})

describe('dismissal', () => {
  const body = JSON.stringify({ itemType: 'focus_area', itemContent: 'CUSTOMER_MARKET', projectId: 'p1' })
  const CALLS: [string, () => Promise<Response>, () => unknown][] = [
    ['POST', () => dismissal.POST(new Request('http://x', { method: 'POST', body })), () => mocks.dismissalUpsert],
    ['GET', () => dismissal.GET(new Request('http://x/api/dismissal?projectId=p1')), () => mocks.dismissalFindMany],
    ['DELETE', () => dismissal.DELETE(new Request('http://x', { method: 'DELETE', body })), () => mocks.dismissalDeleteMany],
  ]

  describe.each(CALLS)('%s', (_m, call, query) => {
    it('anonymous → 401 and nothing is read or written', async () => {
      as(null)
      expect((await call()).status).toBe(401)
      expect(query()).not.toHaveBeenCalled()
    })

    it('a guest works, scoped to their own rows', async () => {
      as('guest-1', true)
      expect((await call()).status).toBe(200)
      expect(JSON.stringify((query() as { mock: { calls: unknown[][] } }).mock.calls[0][0])).toContain('"userId":"guest-1"')
    })
  })
})
