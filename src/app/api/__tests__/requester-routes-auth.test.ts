// @vitest-environment node
/**
 * Routes that act on the requester's own things — pinned as they moved onto the guard (auth-gap
 * plan Task 11, Groups D and E, "behaviour unchanged"). None had a route test before.
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
  projectFindMany: vi.fn(async (_args: { where: object }) => [] as unknown[]),
  projectCount: vi.fn(async () => 0),
  projectCreate: vi.fn(async (_args: { data: object }) => ({ id: 'p-new', name: 'My Project 1', isDemo: false })),
  userFindUnique: vi.fn(),
  pendingTransferDeleteMany: vi.fn(),
  pendingTransferCreate: vi.fn(),
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
    project: { findMany: mocks.projectFindMany, count: mocks.projectCount, create: mocks.projectCreate },
    dimensionalSynthesis: { createMany: vi.fn() },
    user: { findUnique: mocks.userFindUnique },
    pendingGuestTransfer: { deleteMany: mocks.pendingTransferDeleteMany, create: mocks.pendingTransferCreate },
  },
}))
vi.mock('@/lib/user', () => ({ isUserPro: vi.fn(async () => false) }))

import { POST as star } from '../conversation/[id]/star/route'
import * as dismissal from '../dismissal/route'
import * as projects from '../projects/route'
import { GET as account } from '../user/account/route'
import { POST as prepareTransfer } from '../auth/prepare-transfer/route'

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

describe('projects', () => {
  const create = () => projects.POST(new Request('http://x', { method: 'POST', body: '{}' }))

  it('GET: anonymous → 401', async () => {
    as(null)
    expect((await projects.GET()).status).toBe(401)
    expect(mocks.projectFindMany).not.toHaveBeenCalled()
  })

  it('GET: a guest lists their own projects', async () => {
    as('guest-1', true)
    expect((await projects.GET()).status).toBe(200)
    expect(mocks.projectFindMany.mock.calls[0][0].where).toMatchObject({ userId: 'guest-1', status: 'active' })
  })

  it('POST: anonymous → 401', async () => {
    as(null)
    expect((await create()).status).toBe(401)
    expect(mocks.projectCreate).not.toHaveBeenCalled()
  })

  it('POST: a guest → 401 — creating projects is for signed-up users', async () => {
    as('guest-1', true)
    expect((await create()).status).toBe(401)
    expect(mocks.projectCreate).not.toHaveBeenCalled()
  })

  it('POST: a signed-up user creates a project of their own', async () => {
    as('u1')
    expect((await create()).status).toBe(201)
    expect(mocks.projectCreate.mock.calls[0][0].data).toMatchObject({ userId: 'u1', isDemo: false })
  })
})

describe('GET user/account', () => {
  const NOW = new Date('2026-09-11T00:00:00Z')

  it('anonymous → 401', async () => {
    as(null)
    expect((await account()).status).toBe(401)
  })

  it('a guest gets the guest shape — no login methods, never Pro', async () => {
    as('guest-1', true)
    mocks.userFindUnique.mockResolvedValue({ id: 'guest-1', email: 'g@guest.lunastak.io', name: null, createdAt: NOW })
    const res = await account()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ userId: 'guest-1', userType: 'guest', isPro: false, loginMethods: [] })
  })

  it('a signed-up user gets their own row, with login methods', async () => {
    as('u1')
    mocks.userFindUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.co', name: 'A', createdAt: NOW, upgradedAt: NOW, accounts: [],
    })
    const res = await account()
    expect(await res.json()).toMatchObject({ userId: 'u1', userType: 'signed_up', isPro: true, loginMethods: ['email'] })
    expect(mocks.userFindUnique.mock.calls[0][0].where).toEqual({ id: 'u1' })
  })

  it('a signed-up user whose row is gone → 404, as before', async () => {
    as('u1')
    mocks.userFindUnique.mockResolvedValue(null)
    expect((await account()).status).toBe(404)
  })
})

describe('POST auth/prepare-transfer', () => {
  const call = (body: object) =>
    prepareTransfer(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never)

  // Every outcome is a 200: the sign-in page sends the magic link regardless.
  it.each([
    ['no email', {}, 'guest-1'],
    ['no requester', { email: 'A@B.co' }, null],
  ] as const)('%s → 200 and nothing stored', async (_c, body, userId) => {
    as(userId, true)
    const res = await call(body)
    expect(res.status).toBe(200)
    expect(mocks.pendingTransferCreate).not.toHaveBeenCalled()
  })

  it('a signed-in user has no guest to hand over → 200 and nothing stored', async () => {
    as('u1', false)
    expect((await call({ email: 'a@b.co' })).status).toBe(200)
    expect(mocks.pendingTransferCreate).not.toHaveBeenCalled()
  })

  it('a guest’s own id is stored against the (lower-cased) email', async () => {
    as('guest-1', true)
    expect((await call({ email: 'A@B.co' })).status).toBe(200)
    expect(mocks.pendingTransferCreate).toHaveBeenCalledWith({ data: { email: 'a@b.co', guestUserId: 'guest-1' } })
  })
})
