// @vitest-environment node
/**
 * POST /api/conversation/start — whose project a new chat lands in.
 *
 * The route used to read the `guestUserId` cookie raw and hand it to getOrCreateDefaultProject. The
 * cookie is an id, not a proof: set it to a signed-up user's id and the chat started in THEIR
 * projects (auth-gap inventory 2026-09-11). Identity now comes from getRequester(), which validates
 * the cookie against the database; a requester of null means "mint a fresh guest".
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  getOrCreateDefaultProject: vi.fn(),
  getServerSession: vi.fn(),
  cookieGet: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/projects', () => ({ getOrCreateDefaultProject: mocks.getOrCreateDefaultProject }))

// The attack: no session, and a cookie carrying a signed-up user's id. If the route reads either
// directly instead of going through getRequester(), these are what it sees.
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
      create: vi.fn(async ({ data }: { data: { experimentVariant: string } }) => ({ id: 'c1', ...data })),
    },
    message: { create: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('@/lib/statsig', () => ({ getExperimentVariant: vi.fn(async () => 'control') }))
vi.mock('@/lib/knowledge-summary', () => ({ getProjectKnowledgeForPrompt: vi.fn(async () => '') }))
vi.mock('@/lib/claude', () => ({
  createMessage: vi.fn(async () => ({ content: [{ type: 'text', text: 'What are you working on?' }] })),
}))

import { POST } from '../route'

const start = () => POST(new Request('http://x/api/conversation/start', { method: 'POST', body: '{}' }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerSession.mockResolvedValue(null)
  mocks.cookieGet.mockReturnValue({ name: 'guestUserId', value: 'signed-up-user' })
  mocks.getOrCreateDefaultProject.mockImplementation(async (userId: string | null) => ({
    userId: userId ?? 'new-guest',
    project: { id: 'p1', name: 'My Strategy' },
    isGuest: !userId,
  }))
})

it('does not honour an unvalidated cookie — a real user id in guestUserId mints a new guest', async () => {
  mocks.getRequester.mockResolvedValue(null) // cookie failed validation
  const res = await start()
  expect(res.status).toBe(200)
  expect(mocks.getOrCreateDefaultProject).toHaveBeenCalledWith(null)
})

it('uses the validated requester', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'g1', isGuest: true })
  const res = await start()
  expect(res.status).toBe(200)
  expect(mocks.getOrCreateDefaultProject).toHaveBeenCalledWith('g1')
})
