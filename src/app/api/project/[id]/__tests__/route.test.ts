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
 * exercise the prisma + cookie + createGuestUser collaborators directly so
 * a regression in the fallback path will fail loudly.
 */

import { GET } from '../route'

const mockFindFirstProject = vi.fn()
const mockFindUniqueUser = vi.fn()
const mockCookieGet = vi.fn()
const mockCookieSet = vi.fn()
const mockGetServerSession = vi.fn()
const mockCreateGuestUser = vi.fn()
const mockIsGuestUser = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    set: mockCookieSet,
  })),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: (...args: unknown[]) => mockFindFirstProject(...args) },
    user: { findUnique: (...args: unknown[]) => mockFindUniqueUser(...args) },
  },
}))

vi.mock('@/lib/projects', () => ({
  isGuestUser: (...args: unknown[]) => mockIsGuestUser(...args),
  createGuestUser: (...args: unknown[]) => mockCreateGuestUser(...args),
}))

vi.mock('@/lib/constants/dimensions', () => ({ TIER_1_DIMENSIONS: [] }))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })
const req = () => new Request('http://localhost/api/project/demo-1')

describe('GET /api/project/[id] — demo deep-link fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue(null)
    mockCookieGet.mockReturnValue(undefined)
  })

  it('mints a guest user and sets the cookie when an unauthed visitor hits a demo project', async () => {
    // First findFirst call: demoCheck → returns the demo project
    // Second findFirst call: full project fetch → returns minimal project
    mockFindFirstProject
      .mockResolvedValueOnce({ id: 'demo-1' })
      .mockResolvedValueOnce({
        id: 'demo-1',
        isDemo: true,
        status: 'active',
        conversations: [],
        fragments: [],
        documents: [],
        deepDives: [],
        strategyOutputs: [],
      })
    mockCreateGuestUser.mockResolvedValue({ id: 'guest-new' })

    const res = await GET(req(), makeParams('demo-1'))

    expect(mockCreateGuestUser).toHaveBeenCalledTimes(1)
    expect(mockCookieSet).toHaveBeenCalledWith(
      'guestUserId',
      'guest-new',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    )
    expect(res.status).not.toBe(401)
  })

  it('returns 401 for unauthed visitor on a non-demo project', async () => {
    // demoCheck returns null → no fallback
    mockFindFirstProject.mockResolvedValueOnce(null)

    const res = await GET(req(), makeParams('private-1'))

    expect(mockCreateGuestUser).not.toHaveBeenCalled()
    expect(mockCookieSet).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('does not mint a guest when an existing valid guest cookie is present', async () => {
    mockCookieGet.mockReturnValue({ value: 'guest-existing' })
    mockFindUniqueUser.mockResolvedValue({ email: 'guest-x@guest.lunastak.io' })
    mockIsGuestUser.mockReturnValue(true)
    mockFindFirstProject.mockResolvedValueOnce({
      id: 'demo-1',
      isDemo: true,
      status: 'active',
      conversations: [],
      fragments: [],
      documents: [],
      deepDives: [],
      strategyOutputs: [],
    })

    await GET(req(), makeParams('demo-1'))

    expect(mockCreateGuestUser).not.toHaveBeenCalled()
    expect(mockCookieSet).not.toHaveBeenCalled()
  })
})
