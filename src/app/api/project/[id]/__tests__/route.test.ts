/**
 * @jest-environment node
 *
 * Tests for GET /api/project/[id] — demo deep-link guest fallback
 *
 * Verifies the unauthenticated-visitor-on-demo-project flow that was added
 * to fix the 401 returned for marketing/share deep-links.
 *
 * The codebase convention is lightweight contract-style API tests rather
 * than full handler integration with mocked Next runtime. These tests
 * exercise the requester + prisma + cookie + createGuestUser collaborators
 * directly so a regression in the fallback path will fail loudly. The access
 * check is the real guard, so one `project.findFirst` is the guard's query.
 */

import { GET } from '../route'

const mockFindFirstProject = vi.fn()
const mockCookieSet = vi.fn()
const mockGetRequester = vi.fn()
const mockCreateGuestUser = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: mockCookieSet })),
}))

vi.mock('@/lib/auth/current-user', () => ({
  getRequester: (...args: unknown[]) => mockGetRequester(...args),
  GUEST_COOKIE_NAME: 'guestUserId',
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => mockFindFirstProject(...args) },
  },
}))

vi.mock('@/lib/projects', () => ({
  createGuestUser: (...args: unknown[]) => mockCreateGuestUser(...args),
}))

vi.mock('@/lib/constants/dimensions', () => ({ TIER_1_DIMENSIONS: [] }))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
const req = () => new Request('http://localhost/api/project/demo-1')

const demoProject = {
  id: 'demo-1',
  userId: 'demo-owner',
  isDemo: true,
  status: 'active',
  conversations: [],
  fragments: [],
  documents: [],
  deepDives: [],
  strategyOutputs: [],
}

/**
 * A stand-in for the DB: `demo-1` is an active demo project owned by someone else; nothing else
 * exists. A query scoped by requester (the guard's) only finds it if it honours `isDemo`.
 */
const projectTable = async ({ where }: { where: { id: string } }) => {
  const w = JSON.stringify(where)
  if (where.id !== 'demo-1') return null
  return !w.includes('"userId"') || w.includes('"isDemo":true') ? demoProject : null
}

/** The guard's query is the one that scopes by requester. */
const guardWhere = () =>
  JSON.stringify(mockFindFirstProject.mock.calls.map(([a]) => a.where).find(w => JSON.stringify(w).includes('userId')))

describe('GET /api/project/[id] — demo deep-link fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRequester.mockResolvedValue(null)
    mockFindFirstProject.mockImplementation(projectTable)
  })

  it('mints a guest user and sets the cookie when an unauthed visitor hits a demo project', async () => {
    mockCreateGuestUser.mockResolvedValue({ id: 'guest-new' })

    const res = await GET(req(), makeParams('demo-1'))

    expect(mockCreateGuestUser).toHaveBeenCalledTimes(1)
    expect(mockCookieSet).toHaveBeenCalledWith(
      'guestUserId',
      'guest-new',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    )
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(404)
  })

  it('reads the demo as the guest it just minted — not by reading the new cookie back', async () => {
    mockCreateGuestUser.mockResolvedValue({ id: 'guest-new' })

    await GET(req(), makeParams('demo-1'))

    expect(mockGetRequester).toHaveBeenCalledTimes(1)
    expect(guardWhere()).toContain('"userId":"guest-new"')
    expect(guardWhere()).toContain('"isDemo":true')
  })

  it('returns 401 for unauthed visitor on a non-demo project', async () => {
    const res = await GET(req(), makeParams('private-1'))

    expect(mockCreateGuestUser).not.toHaveBeenCalled()
    expect(mockCookieSet).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('does not mint a guest when an existing valid guest cookie is present', async () => {
    mockGetRequester.mockResolvedValue({ userId: 'guest-existing', isGuest: true })

    await GET(req(), makeParams('demo-1'))

    expect(mockCreateGuestUser).not.toHaveBeenCalled()
    expect(mockCookieSet).not.toHaveBeenCalled()
    expect(guardWhere()).toContain('"userId":"guest-existing"')
  })

  it('a signed-in stranger on a private project → 404, and no guest is minted', async () => {
    mockGetRequester.mockResolvedValue({ userId: 'someone-else', isGuest: false })
    // private-1 exists, belongs to `owner`, and is not a demo.
    mockFindFirstProject.mockImplementation(async ({ where }: { where: object }) => {
      const w = JSON.stringify(where)
      return w.includes('"userId"') && !w.includes('"userId":"owner"') ? null : { id: 'private-1', userId: 'owner', isDemo: false, status: 'active' }
    })

    const res = await GET(req(), makeParams('private-1'))

    expect(res.status).toBe(404)
    expect(mockCreateGuestUser).not.toHaveBeenCalled()
  })
})
