// @vitest-environment node
/**
 * Deep dives are owned through their project. Pinned when the two deep-dive routes moved onto the
 * guard (auth-gap plan Task 11, Group D — "behaviour unchanged"): anonymous → 401, a deep dive or
 * project that isn't yours → 404, never through a demo project, and the list/create routes 404 an
 * archived project even for its owner.
 *
 * One deliberate change: `deep-dive/[id]` used to answer a deep dive in someone else's project with
 * a 401, which confirmed the id was real. It's a 404 now, like every other resource the guard hides.
 */
import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  projectFindFirst: vi.fn(),
  deepDiveFindFirst: vi.fn(),
  deepDiveCreate: vi.fn(),
  deepDiveUpdate: vi.fn(),
  deepDiveDelete: vi.fn(),
  deepDiveFindMany: vi.fn(async () => []),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    deepDive: {
      findFirst: mocks.deepDiveFindFirst,
      create: mocks.deepDiveCreate,
      update: mocks.deepDiveUpdate,
      delete: mocks.deepDiveDelete,
      findMany: mocks.deepDiveFindMany,
    },
  },
}))

import * as list from '../route'
import * as single from '../[id]/route'

const NOW = new Date('2026-09-11T00:00:00Z')
const DEEP_DIVE = {
  id: 'dd1', projectId: 'p1', topic: 'Pricing', notes: null, status: 'active', origin: 'manual',
  resolvedAt: null, createdAt: NOW, updatedAt: NOW, conversations: [], documents: [],
}

/** A stand-in for the DB: project p1 belongs to `owner`, and honours the guard's filters. */
function projectTable({ isDemo, status }: { isDemo: boolean; status: string }) {
  return async ({ where }: { where: Record<string, unknown> }) => {
    const w = JSON.stringify(where)
    if (where.id !== 'p1') return null
    if (where.status && where.status !== status) return null
    const owned = w.includes('"userId":"owner"')
    const viaDemo = isDemo && w.includes('"isDemo":true')
    if (!owned && !viaDemo) return null
    return { id: 'p1', userId: 'owner', isDemo, status }
  }
}

const as = (userId: string | null, isGuest = false) =>
  mocks.getRequester.mockResolvedValue(userId ? { userId, isGuest } : null)

const ctx = { params: Promise.resolve({ id: 'dd1' }) }
const json = (method: string, body: object) =>
  new Request('http://x/api/deep-dive', { method, body: JSON.stringify(body) })

type Call = () => Promise<Response>
const CASES: [string, Call, () => unknown][] = [
  ['POST deep-dive', () => list.POST(json('POST', { projectId: 'p1', topic: 'Pricing' })), () => mocks.deepDiveCreate],
  ['GET deep-dive', () => list.GET(new Request('http://x/api/deep-dive?projectId=p1')), () => mocks.deepDiveFindMany],
  ['GET deep-dive/[id]', () => single.GET(new Request('http://x'), ctx), () => null],
  ['PATCH deep-dive/[id]', () => single.PATCH(json('PATCH', { topic: 'New' }), ctx), () => mocks.deepDiveUpdate],
  ['DELETE deep-dive/[id]', () => single.DELETE(new Request('http://x', { method: 'DELETE' }), ctx), () => mocks.deepDiveDelete],
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.projectFindFirst.mockImplementation(projectTable({ isDemo: false, status: 'active' }))
  mocks.deepDiveFindFirst.mockResolvedValue(DEEP_DIVE)
  mocks.deepDiveCreate.mockResolvedValue(DEEP_DIVE)
  mocks.deepDiveUpdate.mockResolvedValue(DEEP_DIVE)
})

describe.each(CASES)('%s', (_name, call, sideEffect) => {
  it('anonymous → 401, before any lookup', async () => {
    as(null)
    expect((await call()).status).toBe(401)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
    expect(mocks.deepDiveFindFirst).not.toHaveBeenCalled()
  })

  it('the owner (a guest counts) gets through', async () => {
    as('owner', true)
    expect((await call()).status).toBe(200)
  })

  it('someone else’s → 404 (not 401/403: don’t confirm the id exists), and nothing is touched', async () => {
    as('someone-else')
    expect((await call()).status).toBe(404)
    const effect = sideEffect()
    if (effect) expect(effect).not.toHaveBeenCalled()
  })

  it('a demo project isn’t someone else’s way in', async () => {
    as('someone-else', true)
    mocks.projectFindFirst.mockImplementation(projectTable({ isDemo: true, status: 'active' }))
    expect((await call()).status).toBe(404)
  })
})

describe('deep-dive/[id]', () => {
  it('a deep dive that doesn’t exist → 404 without consulting the project', async () => {
    as('owner')
    mocks.deepDiveFindFirst.mockResolvedValue(null)
    expect((await single.GET(new Request('http://x'), ctx)).status).toBe(404)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
  })

  it('the guard is asked about the deep dive’s own project', async () => {
    as('owner')
    await single.DELETE(new Request('http://x', { method: 'DELETE' }), ctx)
    expect(mocks.projectFindFirst.mock.calls[0][0].where.id).toBe('p1')
  })
})

describe.each(CASES.slice(0, 2))('%s on an archived project', (_name, call, sideEffect) => {
  it('→ 404, even for its owner', async () => {
    as('owner')
    mocks.projectFindFirst.mockImplementation(projectTable({ isDemo: false, status: 'archived' }))
    expect((await call()).status).toBe(404)
    expect(sideEffect()).not.toHaveBeenCalled()
  })
})
