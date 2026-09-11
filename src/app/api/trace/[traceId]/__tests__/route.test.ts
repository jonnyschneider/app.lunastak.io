// @vitest-environment node
/**
 * GET /api/trace/[traceId] — the owner, or anyone on a demo project's trace. Nobody else.
 *
 * Until 2026-09-11 a caller with no session and no guest cookie could read any trace's full output
 * given its id: a "just generated, before auth transfer" allowance that stopped being needed once
 * guests carried a validated cookie (they pass as owners). Shared links go through /share/[token],
 * not here. (auth-gap plan D6.)
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  traceFindFirst: vi.fn(),
  // The route's data query answers for any id — a route that reaches it without the guard leaks.
  traceFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: { trace: { findFirst: mocks.traceFindFirst, findUnique: mocks.traceFindUnique } },
}))

import { GET } from '../route'

const get = () => GET(new Request('http://x/api/trace/t1') as never, { params: Promise.resolve({ traceId: 't1' }) })

/** A stand-in for the DB: trace t1 belongs to `owner`, on a project that may be a demo. */
function traceTable({ isDemo }: { isDemo: boolean }) {
  return async ({ where }: { where: object }) => {
    const w = JSON.stringify(where)
    const owned = w.includes('"userId":"owner"')
    const viaDemo = isDemo && w.includes('"isDemo":true')
    return owned || viaDemo ? { id: 't1', conversationId: 'c1', projectId: 'p1' } : null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.traceFindFirst.mockImplementation(traceTable({ isDemo: false }))
  mocks.traceFindUnique.mockResolvedValue({
    id: 't1', output: { vision: 'secret' }, extractedContext: {}, claudeThoughts: null,
    conversationId: 'c1', timestamp: new Date('2026-09-11T00:00:00Z'), projectId: 'p1',
    project: { id: 'p1', name: 'Acme', isDemo: false },
  })
})

it('anonymous → 401, without looking the trace up', async () => {
  mocks.getRequester.mockResolvedValue(null)
  expect((await get()).status).toBe(401)
  expect(mocks.traceFindUnique).not.toHaveBeenCalled()
})

it('signed in, not the owner → 404 (not 403: don’t confirm the id exists)', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'someone-else', isGuest: false })
  expect((await get()).status).toBe(404)
  expect(mocks.traceFindUnique).not.toHaveBeenCalled()
})

it('a guest who owns it gets the trace, in the same shape as before', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'owner', isGuest: true })
  const res = await get()
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    id: 't1', output: { vision: 'secret' }, extractedContext: {}, claudeThoughts: null,
    conversationId: 'c1', timestamp: '2026-09-11T00:00:00.000Z', projectId: 'p1',
    projectName: 'Acme', isDemo: false,
  })
})

it('anyone signed in can read a demo project’s trace — the guard is asked for `read`', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'someone-else', isGuest: true })
  mocks.traceFindFirst.mockImplementation(traceTable({ isDemo: true }))
  expect((await get()).status).toBe(200)
  const { where } = mocks.traceFindFirst.mock.calls[0][0]
  expect(JSON.stringify(where)).toContain('isDemo')
})
