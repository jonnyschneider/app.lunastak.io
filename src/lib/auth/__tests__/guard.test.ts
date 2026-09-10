/**
 * The API's one access gate.
 *
 * The ownership `where` clause IS the security property — a guard that fetches the right row but
 * with a looser filter still "works" in every happy-path test. So these tests pin the exact where
 * shape handed to Prisma, not just the 401/404 outcomes.
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  projectFindFirst: vi.fn(),
  conversationFindFirst: vi.fn(),
  traceFindFirst: vi.fn(),
  documentFindFirst: vi.fn(),
  deepDiveCount: vi.fn(),
}))

vi.mock('../current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    conversation: { findFirst: mocks.conversationFindFirst },
    trace: { findFirst: mocks.traceFindFirst },
    document: { findFirst: mocks.documentFindFirst },
    deepDive: { count: mocks.deepDiveCount },
  },
}))

import {
  requireUser,
  requireProjectAccess,
  requireConversationAccess,
  requireTraceAccess,
  requireDocumentAccess,
  deepDiveInProject,
  isDenied,
} from '../guard'

const USER = { userId: 'u1', isGuest: false }
const GUEST = { userId: 'g1', isGuest: true }

beforeEach(() => Object.values(mocks).forEach(m => m.mockReset()))

describe('requireUser', () => {
  it('401s with no requester', async () => {
    mocks.getRequester.mockResolvedValue(null)
    const r = await requireUser()
    expect(isDenied(r) && r.status).toBe(401)
  })

  it('admits a guest by default', async () => {
    mocks.getRequester.mockResolvedValue(GUEST)
    await expect(requireUser()).resolves.toEqual(GUEST)
  })

  it('401s a guest when guests: false', async () => {
    mocks.getRequester.mockResolvedValue(GUEST)
    const r = await requireUser({ guests: false })
    expect(isDenied(r) && r.status).toBe(401)
  })

  it('admits a session user when guests: false', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    await expect(requireUser({ guests: false })).resolves.toEqual(USER)
  })

  it('applies guests: false to a supplied requester too', async () => {
    const r = await requireUser({ guests: false, as: GUEST })
    expect(isDenied(r) && r.status).toBe(401)
    expect(mocks.getRequester).not.toHaveBeenCalled()
  })
})

describe('requireProjectAccess', () => {
  it('write (the default) is owner-only — no isDemo', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.projectFindFirst.mockResolvedValue({ id: 'p1', userId: 'u1', isDemo: false, status: 'active' })
    const r = await requireProjectAccess('p1')
    expect(mocks.projectFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'p1', userId: 'u1' },
    }))
    expect(r).toEqual({ requester: USER, project: { id: 'p1', userId: 'u1', isDemo: false, status: 'active' } })
  })

  it('read admits demo projects', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.projectFindFirst.mockResolvedValue({ id: 'p1', userId: 'x', isDemo: true, status: 'active' })
    await requireProjectAccess('p1', { access: 'read' })
    expect(mocks.projectFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'p1', OR: [{ userId: 'u1' }, { isDemo: true }] },
    }))
  })

  it('404s when the project is not visible', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.projectFindFirst.mockResolvedValue(null)
    const r = await requireProjectAccess('p1')
    expect(isDenied(r) && r.status).toBe(404)
  })

  it('401s before touching the DB when there is no requester', async () => {
    mocks.getRequester.mockResolvedValue(null)
    const r = await requireProjectAccess('p1')
    expect(isDenied(r) && r.status).toBe(401)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
  })

  it('401s a guest before touching the DB when guests: false', async () => {
    mocks.getRequester.mockResolvedValue(GUEST)
    const r = await requireProjectAccess('p1', { guests: false })
    expect(isDenied(r) && r.status).toBe(401)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
  })

  it('uses a supplied requester instead of re-resolving', async () => {
    mocks.projectFindFirst.mockResolvedValue({ id: 'p1', userId: 'u1', isDemo: false, status: 'active' })
    await requireProjectAccess('p1', { as: USER })
    expect(mocks.getRequester).not.toHaveBeenCalled()
  })
})

describe('requireConversationAccess', () => {
  it('write: own conversation OR own project', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.conversationFindFirst.mockResolvedValue({ id: 'c1', userId: 'u1', projectId: 'p1' })
    const r = await requireConversationAccess('c1')
    expect(mocks.conversationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1', OR: [{ userId: 'u1' }, { project: { userId: 'u1' } }] },
    }))
    expect(r).toEqual({ requester: USER, conversation: { id: 'c1', userId: 'u1', projectId: 'p1' } })
  })

  it('read: also a demo project’s conversation', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.conversationFindFirst.mockResolvedValue({ id: 'c1', userId: 'x', projectId: 'demo' })
    await requireConversationAccess('c1', { access: 'read' })
    expect(mocks.conversationFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'c1',
        OR: [{ userId: 'u1' }, { project: { OR: [{ userId: 'u1' }, { isDemo: true }] } }],
      },
    }))
  })

  it('404s someone else’s conversation', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.conversationFindFirst.mockResolvedValue(null)
    const r = await requireConversationAccess('c1')
    expect(isDenied(r) && r.status).toBe(404)
  })

  it('401s before touching the DB when there is no requester', async () => {
    mocks.getRequester.mockResolvedValue(null)
    const r = await requireConversationAccess('c1')
    expect(isDenied(r) && r.status).toBe(401)
    expect(mocks.conversationFindFirst).not.toHaveBeenCalled()
  })
})

describe('requireTraceAccess', () => {
  it('write: owner via trace, conversation, or project', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.traceFindFirst.mockResolvedValue({ id: 't1', conversationId: 'c1', projectId: 'p1' })
    await requireTraceAccess('t1')
    expect(mocks.traceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 't1',
        OR: [{ userId: 'u1' }, { conversation: { userId: 'u1' } }, { project: { userId: 'u1' } }],
      },
    }))
  })

  it('read: also a demo project’s trace', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.traceFindFirst.mockResolvedValue({ id: 't1', conversationId: 'c1', projectId: 'demo' })
    await requireTraceAccess('t1', { access: 'read' })
    expect(mocks.traceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 't1',
        OR: [
          { userId: 'u1' },
          { conversation: { userId: 'u1' } },
          { project: { OR: [{ userId: 'u1' }, { isDemo: true }] } },
        ],
      },
    }))
  })

  it('404s a trace the requester cannot see', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.traceFindFirst.mockResolvedValue(null)
    const r = await requireTraceAccess('t1')
    expect(isDenied(r) && r.status).toBe(404)
  })

  // The old trace route let a caller with no session and no cookie through. The guard never does.
  it('401s with no requester — no anonymous branch', async () => {
    mocks.getRequester.mockResolvedValue(null)
    const r = await requireTraceAccess('t1', { access: 'read' })
    expect(isDenied(r) && r.status).toBe(401)
    expect(mocks.traceFindFirst).not.toHaveBeenCalled()
  })
})

describe('requireDocumentAccess', () => {
  it('write: scopes through the project', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.documentFindFirst.mockResolvedValue({ id: 'd1', projectId: 'p1' })
    await requireDocumentAccess('d1')
    expect(mocks.documentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'd1', project: { userId: 'u1' } },
    }))
  })

  it('read: also a demo project’s document', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.documentFindFirst.mockResolvedValue({ id: 'd1', projectId: 'demo' })
    await requireDocumentAccess('d1', { access: 'read' })
    expect(mocks.documentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'd1', project: { OR: [{ userId: 'u1' }, { isDemo: true }] } },
    }))
  })

  it('404s a document the requester cannot see', async () => {
    mocks.getRequester.mockResolvedValue(USER)
    mocks.documentFindFirst.mockResolvedValue(null)
    const r = await requireDocumentAccess('d1')
    expect(isDenied(r) && r.status).toBe(404)
  })
})

describe('deepDiveInProject', () => {
  it('is true only when the deep dive belongs to the project', async () => {
    mocks.deepDiveCount.mockResolvedValue(1)
    await expect(deepDiveInProject('dd1', 'p1')).resolves.toBe(true)
    expect(mocks.deepDiveCount).toHaveBeenCalledWith({ where: { id: 'dd1', projectId: 'p1' } })
    mocks.deepDiveCount.mockResolvedValue(0)
    await expect(deepDiveInProject('dd1', 'p2')).resolves.toBe(false)
  })
})

describe('isDenied', () => {
  it('is true for a response and false for a requester or resource', async () => {
    mocks.getRequester.mockResolvedValue(null)
    expect(isDenied(await requireUser())).toBe(true)
    expect(isDenied(USER)).toBe(false)
    expect(isDenied({ requester: USER, project: { id: 'p1' } })).toBe(false)
  })
})
