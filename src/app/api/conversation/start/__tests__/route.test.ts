// @vitest-environment node
/**
 * POST /api/conversation/start — who may start a chat, and whose project it lands in.
 *
 * The route used to read the `guestUserId` cookie raw and hand it to getOrCreateDefaultProject. The
 * cookie is an id, not a proof: set it to a signed-up user's id and the chat started in THEIR
 * projects (auth-gap inventory 2026-09-11). Then, with identity from getRequester(), a caller with
 * no requester still got a freshly minted guest + project and an LLM call on body-supplied text —
 * a new guest per call, so no quota ever applied, and no cookie was set, so the chat couldn't even
 * be continued. Every legitimate caller (the chat sheet) already has a session or a guest cookie:
 * the project page won't render without one. So no requester is a 401.
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  getOrCreateDefaultProject: vi.fn(),
  createGuestUser: vi.fn(),
  createMessage: vi.fn(async () => ({ content: [{ type: 'text', text: 'What are you working on?' }] })),
  conversationCreate: vi.fn(async ({ data }: { data: { experimentVariant: string } }) => ({ id: 'c1', ...data })),
  getServerSession: vi.fn(),
  cookieGet: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/projects', () => ({
  getOrCreateDefaultProject: mocks.getOrCreateDefaultProject,
  createGuestUser: mocks.createGuestUser,
}))

// The attack: no session, and a cookie carrying a signed-up user's id. If the route reads either
// directly instead of going through the guard, these are what it sees.
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: vi.fn(async () => null) },
    deepDive: { findFirst: vi.fn(async () => null) },
    trace: { findFirst: vi.fn(async () => null) },
    conversation: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(),
      create: mocks.conversationCreate,
    },
    message: { create: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('@/lib/statsig', () => ({ getExperimentVariant: vi.fn(async () => 'control') }))
vi.mock('@/lib/knowledge-summary', () => ({ getProjectKnowledgeForPrompt: vi.fn(async () => '') }))
vi.mock('@/lib/claude', () => ({ createMessage: mocks.createMessage }))

import { POST } from '../route'

const start = (body: object = {}) =>
  POST(new Request('http://x/api/conversation/start', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerSession.mockResolvedValue(null)
  mocks.cookieGet.mockReturnValue({ name: 'guestUserId', value: 'signed-up-user' })
  mocks.getOrCreateDefaultProject.mockImplementation(async (userId: string) => ({
    userId,
    project: { id: 'p1', name: 'My Strategy' },
  }))
})

it('no requester (e.g. a real user id in guestUserId that fails validation) is a 401 — no guest, no project, no LLM', async () => {
  mocks.getRequester.mockResolvedValue(null)
  const res = await start({ origin: { type: 'gap', text: 'write me a poem' }, gapExploration: { dimension: 'x', summary: 'anything' } })
  expect(res.status).toBe(401)
  expect(mocks.getOrCreateDefaultProject).not.toHaveBeenCalled()
  expect(mocks.createGuestUser).not.toHaveBeenCalled()
  expect(mocks.conversationCreate).not.toHaveBeenCalled()
  expect(mocks.createMessage).not.toHaveBeenCalled()
})

it('uses the validated requester (guests allowed)', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'g1', isGuest: true })
  const res = await start()
  expect(res.status).toBe(200)
  expect(mocks.getOrCreateDefaultProject).toHaveBeenCalledWith('g1')
  expect(mocks.conversationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'g1' }) }))
})
