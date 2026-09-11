// @vitest-environment node
/**
 * Signed-up-only routes (plan decision D5) — pinned as they moved onto the guard with
 * `{ guests: false }` (auth-gap plan Task 11, Group F, "behaviour unchanged"). None had a route
 * test before. For each: anonymous → 401, a guest → 401, and where the route addresses a
 * resource, someone else's → 404 (never 403) with nothing changed.
 */
import { vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  projectFindFirst: vi.fn(),
  conversationFindFirst: vi.fn(),
  traceFindFirst: vi.fn(),
  traceFindMany: vi.fn(async (_args: { where: object }) => [] as unknown[]),
  traceUpdate: vi.fn(async () => ({ id: 't1', starred: true, starredAt: null })),
  projectUpdate: vi.fn(async () => ({ id: 'p1', name: 'Renamed' })),
  projectDelete: vi.fn(),
  userUpdate: vi.fn(async () => ({ id: 'u1', email: 'a@b.co', upgradedAt: new Date() })),
  eventCreate: vi.fn(async () => ({})),
  setProjectSharing: vi.fn(async () => ({ enabled: true, shareToken: 'tok' })),
  getShareState: vi.fn(async () => ({ enabled: false, shareToken: null })),
  transferGuestToUser: vi.fn(async () => true),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester, GUEST_COOKIE_NAME: 'guestUserId' }))
vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst, update: mocks.projectUpdate, delete: mocks.projectDelete, count: vi.fn(async () => 0) },
    conversation: { findFirst: mocks.conversationFindFirst, findMany: vi.fn(async () => []), deleteMany: vi.fn() },
    trace: { findFirst: mocks.traceFindFirst, findMany: mocks.traceFindMany, update: mocks.traceUpdate },
    user: { update: mocks.userUpdate },
    event: { create: mocks.eventCreate },
    dimensionalSynthesis: { deleteMany: vi.fn() },
    fragmentDimensionTag: { deleteMany: vi.fn() },
    fragment: { deleteMany: vi.fn() },
    document: { deleteMany: vi.fn() },
    deepDive: { deleteMany: vi.fn() },
    userDismissal: { deleteMany: vi.fn() },
  },
}))
vi.mock('@/lib/share', () => ({ getShareState: mocks.getShareState, setProjectSharing: mocks.setProjectSharing }))
vi.mock('@/lib/transfer-session', () => ({ transferGuestToUser: mocks.transferGuestToUser }))
vi.mock('@/lib/user', () => ({ isUserPro: vi.fn(async () => false) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }) }))

import * as share from '../project/[id]/share/route'
import * as projectById from '../projects/[id]/route'
import { GET as strategies } from '../strategies/route'
import { PATCH as starStrategy } from '../strategies/[id]/route'
import { GET as detail } from '../conversation/[id]/detail/route'
import { POST as paywall } from '../paywall/prompt/route'
import { POST as upgrade } from '../user/upgrade/route'
import { POST as transfer } from '../transfer-session/route'

const as = (userId: string | null, isGuest = false) =>
  mocks.getRequester.mockResolvedValue(userId ? { userId, isGuest } : null)

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (method: string, body?: object) =>
  new NextRequest('http://x/api/any', { method, ...(body ? { body: JSON.stringify(body) } : {}) })

/**
 * Stand-ins for the DB. Every resource belongs to `owner`. A guard query carries the requester's
 * id; a route's own data query (by id alone, once the guard has passed) answers for anyone.
 */
const ownedBy = (where: object) => JSON.stringify(where).includes('"userId":"owner"')
const scoped = (where: object) => JSON.stringify(where).includes('"userId"')
function stubTables({ isDemo = false } = {}) {
  mocks.projectFindFirst.mockImplementation(async ({ where }) =>
    ownedBy(where) ? { id: 'p1', userId: 'owner', isDemo, status: 'active' } : null)
  mocks.conversationFindFirst.mockImplementation(async ({ where }) => {
    if (scoped(where) && !ownedBy(where)) return null
    return {
      id: 'c1', userId: 'owner', projectId: 'p1', status: 'active', createdAt: new Date(),
      messages: [], fragments: [], project: { id: 'p1', name: 'Acme' },
    }
  })
  mocks.traceFindFirst.mockImplementation(async ({ where }) =>
    scoped(where) && !ownedBy(where) ? null : { id: 't1' })
}

type Case = {
  call: () => Promise<Response>
  /** What a request that got past the guard would change — must stay untouched when denied. */
  effect?: () => ReturnType<typeof vi.fn>
  /** Does the route address someone's resource (so a stranger gets a 404)? */
  resource?: boolean
}

const CASES: Record<string, Case> = {
  'GET project/[id]/share': { call: () => share.GET(req('GET'), ctx('p1')), effect: () => mocks.getShareState, resource: true },
  'POST project/[id]/share': { call: () => share.POST(req('POST', { enabled: true }), ctx('p1')), effect: () => mocks.setProjectSharing, resource: true },
  'PATCH projects/[id]': { call: () => projectById.PATCH(req('PATCH', { name: 'Renamed' }), ctx('p1')), effect: () => mocks.projectUpdate, resource: true },
  'DELETE projects/[id]': { call: () => projectById.DELETE(req('DELETE'), ctx('p1')), effect: () => mocks.projectDelete, resource: true },
  'GET strategies': { call: () => strategies(req('GET')), effect: () => mocks.traceFindMany },
  'PATCH strategies/[id]': { call: () => starStrategy(req('PATCH', { starred: true }), ctx('t1')), effect: () => mocks.traceUpdate, resource: true },
  'GET conversation/[id]/detail': { call: () => detail(req('GET'), ctx('c1')), resource: true },
  'POST paywall/prompt': { call: () => paywall(req('POST', { feature: 'export_pdf' })), effect: () => mocks.eventCreate },
  'POST user/upgrade': { call: () => upgrade(req('POST', { feature: 'export_pdf' })), effect: () => mocks.userUpdate },
  'POST transfer-session': { call: () => transfer(req('POST')), effect: () => mocks.transferGuestToUser },
}

beforeEach(() => {
  vi.clearAllMocks()
  stubTables()
  mocks.cookieGet.mockReturnValue({ value: 'guest-1' })
})

describe.each(Object.entries(CASES))('%s', (_name, { call, effect, resource }) => {
  it('anonymous → 401, nothing changed', async () => {
    as(null)
    expect((await call()).status).toBe(401)
    if (effect) expect(effect()).not.toHaveBeenCalled()
  })

  it('a guest → 401 — signed-up users only', async () => {
    as('owner', true)
    expect((await call()).status).toBe(401)
    if (effect) expect(effect()).not.toHaveBeenCalled()
  })

  it('the signed-up owner gets through', async () => {
    as('owner')
    expect((await call()).status).toBeLessThan(300)
  })

  if (resource) {
    it('someone else’s → 404, nothing changed', async () => {
      as('someone-else')
      expect((await call()).status).toBe(404)
      if (effect) expect(effect()).not.toHaveBeenCalled()
    })
  }
})

describe('project/[id]/share', () => {
  it('a demo project isn’t shareable, even by its owner → 404', async () => {
    as('owner')
    stubTables({ isDemo: true })
    expect((await share.POST(req('POST', { enabled: true }), ctx('p1'))).status).toBe(404)
    expect(mocks.setProjectSharing).not.toHaveBeenCalled()
  })

  it('never honours demo projects as a way in', async () => {
    as('someone-else')
    await share.GET(req('GET'), ctx('p1'))
    expect(JSON.stringify(mocks.projectFindFirst.mock.calls[0][0].where)).not.toContain('isDemo')
  })
})

describe('GET strategies', () => {
  it('lists only the requester’s own strategies', async () => {
    as('u1')
    await strategies(req('GET'))
    expect(mocks.traceFindMany.mock.calls[0][0].where).toEqual({ userId: 'u1' })
  })
})

describe('POST user/upgrade', () => {
  it('upgrades the requester’s own row', async () => {
    as('u1')
    await upgrade(req('POST', {}))
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }))
  })
})

describe('POST transfer-session', () => {
  it('hands the guest cookie to the signed-in user, then clears it', async () => {
    as('u1')
    expect((await transfer(req('POST'))).status).toBe(200)
    expect(mocks.cookieGet).toHaveBeenCalledWith('guestUserId')
    expect(mocks.transferGuestToUser).toHaveBeenCalledWith('guest-1', 'u1')
    expect(mocks.cookieDelete).toHaveBeenCalledWith('guestUserId')
  })

  it('a guest alone keeps their cookie — nothing to transfer to', async () => {
    as('guest-1', true)
    await transfer(req('POST'))
    expect(mocks.cookieDelete).not.toHaveBeenCalled()
  })

  it('no guest cookie → 200, nothing transferred', async () => {
    as('u1')
    mocks.cookieGet.mockReturnValue(undefined)
    expect((await transfer(req('POST'))).status).toBe(200)
    expect(mocks.transferGuestToUser).not.toHaveBeenCalled()
  })
})
