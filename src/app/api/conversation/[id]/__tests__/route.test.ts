// @vitest-environment node
/**
 * GET / PATCH /api/conversation/[id] — only the owner (or, for GET, a demo project's viewer).
 *
 * Both handlers used to take the id alone: anyone could read a conversation's full transcript, or
 * PATCH it — including pointing it at a deep dive in another project, the same planting bug as
 * documents/upload through a second door (auth-gap inventory 2026-09-11, plan D7).
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationFindUnique: vi.fn(),
  conversationUpdate: vi.fn(),
  deepDiveCount: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      // The guard's ownership lookup.
      findFirst: mocks.conversationFindFirst,
      // The route's data query — it answers for any id, so a route that only checks existence leaks.
      findUnique: mocks.conversationFindUnique,
      update: mocks.conversationUpdate,
    },
    deepDive: { count: mocks.deepDiveCount },
  },
}))

import { GET, PATCH } from '../route'

const params = { params: Promise.resolve({ id: 'c1' }) }
const get = () => GET(new Request('http://x/api/conversation/c1'), params)
const patch = (body: object) =>
  PATCH(new Request('http://x/api/conversation/c1', { method: 'PATCH', body: JSON.stringify(body) }), params)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRequester.mockResolvedValue({ userId: 'u1', isGuest: false })
  mocks.conversationFindFirst.mockResolvedValue({ id: 'c1', userId: 'u1', projectId: 'p1' })
  mocks.conversationFindUnique.mockResolvedValue({
    id: 'c1', status: 'in_progress', currentPhase: 'INITIAL', experimentVariant: 'control',
    messages: [{ id: 'm1', content: 'secret' }], deepDiveId: null, deepDive: null, isInitialConversation: true,
  })
  // Only deep dive dd-own is in p1.
  mocks.deepDiveCount.mockImplementation(async ({ where }: { where: { id: string; projectId: string } }) =>
    where.id === 'dd-own' && where.projectId === 'p1' ? 1 : 0,
  )
  mocks.conversationUpdate.mockImplementation(async ({ data }: { data: { deepDiveId?: string | null } }) => ({
    deepDiveId: data.deepDiveId ?? null, deepDive: data.deepDiveId ? { id: data.deepDiveId, topic: 'T' } : null,
    status: 'in_progress',
  }))
})

describe('GET', () => {
  it('anonymous → 401', async () => {
    mocks.getRequester.mockResolvedValue(null)
    expect((await get()).status).toBe(401)
  })

  it('not the owner → 404', async () => {
    mocks.conversationFindFirst.mockResolvedValue(null)
    expect((await get()).status).toBe(404)
  })

  it('reads at `read` access, so a demo project’s conversations still open', async () => {
    await get()
    const { where } = mocks.conversationFindFirst.mock.calls[0][0]
    expect(JSON.stringify(where)).toContain('isDemo')
  })

  it('the owner gets the conversation', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect((await res.json()).messages).toHaveLength(1)
  })
})

describe('PATCH', () => {
  it('anonymous → 401, nothing updated', async () => {
    mocks.getRequester.mockResolvedValue(null)
    expect((await patch({ status: 'completed' })).status).toBe(401)
    expect(mocks.conversationUpdate).not.toHaveBeenCalled()
  })

  it('not the owner → 404, nothing updated', async () => {
    mocks.conversationFindFirst.mockResolvedValue(null)
    expect((await patch({ status: 'completed' })).status).toBe(404)
    expect(mocks.conversationUpdate).not.toHaveBeenCalled()
  })

  it('writes at `write` access — a demo project’s conversation is not patchable by viewers', async () => {
    await patch({ status: 'completed' })
    const { where } = mocks.conversationFindFirst.mock.calls[0][0]
    expect(JSON.stringify(where)).not.toContain('isDemo')
  })

  it('a deepDiveId from another project → 400, nothing updated', async () => {
    expect((await patch({ deepDiveId: 'dd-foreign' })).status).toBe(400)
    expect(mocks.conversationUpdate).not.toHaveBeenCalled()
  })

  it('a conversation with no project can’t take a deep dive → 400', async () => {
    mocks.conversationFindFirst.mockResolvedValue({ id: 'c1', userId: 'u1', projectId: null })
    expect((await patch({ deepDiveId: 'dd-own' })).status).toBe(400)
    expect(mocks.conversationUpdate).not.toHaveBeenCalled()
  })

  it('the owner attaches a deep dive of the same project', async () => {
    const res = await patch({ deepDiveId: 'dd-own' })
    expect(res.status).toBe(200)
    expect((await res.json()).deepDiveId).toBe('dd-own')
  })

  it('the owner can detach (deepDiveId null skips the project check)', async () => {
    const res = await patch({ deepDiveId: null })
    expect(res.status).toBe(200)
    expect(mocks.conversationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { deepDiveId: null } }))
  })
})
