// @vitest-environment node
/**
 * POST /api/documents/upload — who may upload, and which deep dive it may land in.
 *
 * The route checked the project was the user's but trusted `deepDiveId` from the form as-is, so a
 * known deep-dive id from ANOTHER project planted a document in someone else's deep dive (auth-gap
 * inventory 2026-09-11). It also stays session-only: a guest cookie is a 401, as it was before the
 * guard (plan D5 — a security pass, not a product change).
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  projectFindFirst: vi.fn(),
  deepDiveCount: vi.fn(),
  documentCreate: vi.fn(),
  documentUpdate: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
// Identity must come from getRequester(). A route reading the session directly would see this one.
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    deepDive: { count: mocks.deepDiveCount },
    document: { create: mocks.documentCreate, update: mocks.documentUpdate },
  },
}))
vi.mock('@/lib/document-processing', () => ({ processDocument: vi.fn(async () => undefined) }))
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))

import { POST } from '../route'

function upload(fields: Record<string, string> = {}) {
  const form = new FormData()
  form.append('file', new File(['# notes'], 'notes.md', { type: 'text/markdown' }))
  form.append('projectId', 'p1')
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  return POST(new Request('http://x/api/documents/upload', { method: 'POST', body: form }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRequester.mockResolvedValue({ userId: 'u1', isGuest: false })
  mocks.projectFindFirst.mockResolvedValue({ id: 'p1', userId: 'u1', isDemo: false, status: 'active' })
  // Only deep dive dd-own is in p1.
  mocks.deepDiveCount.mockImplementation(async ({ where }: { where: { id: string; projectId: string } }) =>
    where.id === 'dd-own' && where.projectId === 'p1' ? 1 : 0,
  )
  mocks.documentCreate.mockImplementation(async ({ data }: { data: { fileName: string } }) => ({ id: 'd1', ...data }))
})

it('anonymous → 401', async () => {
  mocks.getRequester.mockResolvedValue(null)
  expect((await upload()).status).toBe(401)
  expect(mocks.documentCreate).not.toHaveBeenCalled()
})

it('a guest → 401 (uploads stay session-only)', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'g1', isGuest: true })
  expect((await upload()).status).toBe(401)
  expect(mocks.documentCreate).not.toHaveBeenCalled()
})

it('a project that is not the requester’s → 404', async () => {
  mocks.projectFindFirst.mockResolvedValue(null)
  expect((await upload()).status).toBe(404)
  expect(mocks.documentCreate).not.toHaveBeenCalled()
})

it('a deepDiveId from another project → 400, and no document is created', async () => {
  const res = await upload({ deepDiveId: 'dd-foreign' })
  expect(res.status).toBe(400)
  expect(mocks.documentCreate).not.toHaveBeenCalled()
})

it('a deepDiveId of this project → 200, attached', async () => {
  const res = await upload({ deepDiveId: 'dd-own' })
  expect(res.status).toBe(200)
  expect(mocks.documentCreate).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ projectId: 'p1', deepDiveId: 'dd-own' }) }),
  )
})
