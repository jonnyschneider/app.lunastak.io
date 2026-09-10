// @vitest-environment node
/**
 * The access rule of each `project/[id]/*` sub-route, pinned as it stood before the routes moved
 * onto the guard (auth-gap plan Task 11, Group A — "behaviour unchanged"). These routes had no
 * tests, so this is the net: anonymous → 401, someone else's project → 404 (never 403), demo
 * projects readable only where they were before, and archived projects 404 where the route
 * filtered on `status: 'active'`.
 */
import { vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  projectFindFirst: vi.fn(),
  projectFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: { project: { findFirst: mocks.projectFindFirst, findUnique: mocks.projectFindUnique } },
}))
// Everything past the access check. Every case below is denied before reaching any of it — a
// route that got this far would throw on the stubs and fail the status assertion.
vi.mock('@/lib/claude', () => ({ createMessage: vi.fn() }))
vi.mock('@/lib/projects', () => ({ checkAndIncrementGuestApiCalls: vi.fn() }))
vi.mock('@/lib/pipeline', () => ({ planPipeline: vi.fn(), executePipeline: vi.fn() }))
vi.mock('@/lib/import', () => ({ planImport: vi.fn(), executeImport: vi.fn() }))
vi.mock('@/lib/decision-stack', () => ({
  setGenerationStatus: vi.fn(), hasDecisionStack: vi.fn(), updateSingleton: vi.fn(),
  updateComponent: vi.fn(), getSnapshots: vi.fn(),
}))
vi.mock('@/lib/synthesis/update-synthesis', () => ({ updateAllSyntheses: vi.fn() }))
vi.mock('@/lib/knowledge-summary', () => ({ generateKnowledgeSummary: vi.fn() }))
vi.mock('@/lib/strategic-brief', () => ({ generateStrategicBrief: vi.fn() }))
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))

import * as strategy from '../strategy/route'
import * as strategyVersion from '../strategy-version/route'
import * as templateEntry from '../template-entry/route'
import * as exportBrief from '../export-brief/route'
import * as generateOpportunities from '../generate-opportunities/route'
import * as generateStrategy from '../generate-strategy/route'
import * as importBundle from '../import-bundle/route'
import * as refreshStrategy from '../refresh-strategy/route'
import * as synthesize from '../synthesize/route'

type Handler = (req: never, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

/** [name, handler, demo-readable?, archived projects 404?] */
const ROUTES: [string, Handler, boolean, boolean][] = [
  ['strategy GET', strategy.GET as Handler, false, false],
  ['strategy-version GET', strategyVersion.GET as Handler, true, false],
  ['strategy-version POST', strategyVersion.POST as Handler, false, false],
  ['template-entry POST', templateEntry.POST as Handler, false, false],
  ['export-brief GET', exportBrief.GET as Handler, true, true],
  ['generate-opportunities POST', generateOpportunities.POST as Handler, false, true],
  ['generate-strategy POST', generateStrategy.POST as Handler, false, true],
  ['import-bundle POST', importBundle.POST as Handler, false, true],
  ['refresh-strategy POST', refreshStrategy.POST as Handler, false, true],
  ['synthesize POST', synthesize.POST as Handler, false, true],
]

const call = (handler: Handler) =>
  handler(
    new NextRequest('http://x/api/project/p1/any', { method: 'POST', body: '{}' }) as never,
    { params: Promise.resolve({ id: 'p1' }) },
  )

/** A stand-in for the DB: project p1 belongs to `owner`. The guard's query carries a userId filter. */
function projectTable({ isDemo, status }: { isDemo: boolean; status: string }) {
  return async ({ where }: { where: Record<string, unknown> }) => {
    const w = JSON.stringify(where)
    if (where.status && where.status !== status) return null
    const guardQuery = w.includes('"userId"')
    const owned = w.includes('"userId":"owner"')
    const viaDemo = isDemo && w.includes('"isDemo":true')
    if (guardQuery && !owned && !viaDemo) return null
    return { id: 'p1', userId: 'owner', isDemo, status, name: 'Acme', suggestedQuestions: [], decisionStack: null }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.projectFindFirst.mockImplementation(projectTable({ isDemo: false, status: 'active' }))
})

describe.each(ROUTES)('%s', (_name, handler, demoReadable, activeOnly) => {
  it('anonymous → 401', async () => {
    mocks.getRequester.mockResolvedValue(null)
    expect((await call(handler)).status).toBe(401)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
  })

  it('someone else’s project → 404 (not 403: don’t confirm the id exists)', async () => {
    mocks.getRequester.mockResolvedValue({ userId: 'someone-else', isGuest: false })
    expect((await call(handler)).status).toBe(404)
  })

  it(demoReadable ? 'honours demo projects (read)' : 'owner only — a demo project is not writable', async () => {
    mocks.getRequester.mockResolvedValue({ userId: 'someone-else', isGuest: true })
    await call(handler)
    const { where } = mocks.projectFindFirst.mock.calls[0][0]
    expect(JSON.stringify(where).includes('isDemo')).toBe(demoReadable)
  })

  if (activeOnly) {
    it('an archived project → 404, even for its owner', async () => {
      mocks.getRequester.mockResolvedValue({ userId: 'owner', isGuest: false })
      mocks.projectFindFirst.mockImplementation(projectTable({ isDemo: false, status: 'archived' }))
      expect((await call(handler)).status).toBe(404)
    })
  }
})
