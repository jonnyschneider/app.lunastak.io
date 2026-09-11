// @vitest-environment node
/**
 * The status-polling routes answer only for the caller's own project / document (or a demo's).
 *
 * Until 2026-09-11 (auth-gap inventory) both took the id alone: anyone could poll any project's
 * generation status, or any document's processing status and file name. They're polled every few
 * seconds by BackgroundTaskProvider, so they read at `read` — a demo viewer's polls still work.
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  projectFindFirst: vi.fn(),
  documentFindFirst: vi.fn(),
  // The routes' own data queries answer for any id — a route that reaches them without the guard leaks.
  getGenerationStatus: vi.fn(async () => ({ status: 'generating', startedAt: new Date() })),
  documentFindUnique: vi.fn(async () => ({ id: 'd1', status: 'complete', fileName: 'secret.pdf', fragments: [] })),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    document: { findFirst: mocks.documentFindFirst, findUnique: mocks.documentFindUnique },
  },
}))
vi.mock('@/lib/decision-stack', () => ({ getGenerationStatus: mocks.getGenerationStatus }))

import { GET as getGenerationStatus } from '../project/[id]/generation-status/route'
import { GET as getDocumentStatus } from '../documents/[id]/status/route'

const req = () => new Request('http://x/api')

const CASES = [
  ['GET project/[id]/generation-status', mocks.projectFindFirst, mocks.getGenerationStatus,
    () => getGenerationStatus(req(), { params: Promise.resolve({ id: 'p1' }) })],
  ['GET documents/[id]/status', mocks.documentFindFirst, mocks.documentFindUnique,
    () => getDocumentStatus(req(), { params: Promise.resolve({ id: 'd1' }) })],
] as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRequester.mockResolvedValue({ userId: 'u1', isGuest: false })
  mocks.projectFindFirst.mockResolvedValue(null)
  mocks.documentFindFirst.mockResolvedValue(null)
})

describe.each(CASES)('%s', (_, guardLookup, dataQuery, call) => {
  it('401s an anonymous caller without a DB lookup', async () => {
    mocks.getRequester.mockResolvedValue(null)
    expect((await call()).status).toBe(401)
    expect(guardLookup).not.toHaveBeenCalled()
    expect(dataQuery).not.toHaveBeenCalled()
  })

  it('404s someone else’s, without reading its status', async () => {
    expect((await call()).status).toBe(404)
    expect(dataQuery).not.toHaveBeenCalled()
  })

  it('checks at `read` access, so a demo project’s polls still answer', async () => {
    await call()
    expect(JSON.stringify(guardLookup.mock.calls[0][0].where)).toContain('isDemo')
  })
})
