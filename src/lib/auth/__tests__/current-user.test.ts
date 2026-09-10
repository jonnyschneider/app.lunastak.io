/**
 * The one definition of "who is this request", shared by the dismissal API and the navigation
 * redirector.
 *
 * The guest branch is the security boundary for every unauthenticated request in the product: the
 * cookie carries an id, not a proof, so the row must exist AND be a guest. Eight routes each had
 * their own copy of this when it was extracted; all eight validated, which was luck.
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations — without it
// the factories close over variables that are still in their temporal dead zone.
const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  cookieGet: vi.fn(),
  findUnique: vi.fn(),
}))
const { getServerSession, cookieGet, findUnique } = mocks

vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookieGet }) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }))
vi.mock('@/lib/projects', () => ({ isGuestUser: (email: string | null) => !!email?.startsWith('guest-') }))

import { getRequester, getUserId, GUEST_COOKIE_NAME } from '../current-user'

beforeEach(() => {
  getServerSession.mockReset()
  cookieGet.mockReset()
  findUnique.mockReset()
})

it('prefers the session, and never touches the cookie when one exists', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'real-user' } })
  await expect(getUserId()).resolves.toBe('real-user')
  expect(cookieGet).not.toHaveBeenCalled()
})

it('falls back to a validated guest cookie', async () => {
  getServerSession.mockResolvedValue(null)
  cookieGet.mockReturnValue({ value: 'guest-1' })
  findUnique.mockResolvedValue({ email: 'guest-1@lunastak.local' })
  await expect(getUserId()).resolves.toBe('guest-1')
  expect(cookieGet).toHaveBeenCalledWith(GUEST_COOKIE_NAME)
})

it('rejects a cookie pointing at a REAL user — the boundary that makes the cookie safe', async () => {
  getServerSession.mockResolvedValue(null)
  cookieGet.mockReturnValue({ value: 'someone-elses-id' })
  findUnique.mockResolvedValue({ email: 'jonny@humventures.com.au' })
  await expect(getUserId()).resolves.toBeNull()
})

it('rejects a cookie pointing at nothing', async () => {
  getServerSession.mockResolvedValue(null)
  cookieGet.mockReturnValue({ value: 'deleted-guest' })
  findUnique.mockResolvedValue(null)
  await expect(getUserId()).resolves.toBeNull()
})

it('returns null when there is neither', async () => {
  getServerSession.mockResolvedValue(null)
  cookieGet.mockReturnValue(undefined)
  await expect(getUserId()).resolves.toBeNull()
})

// getRequester keeps what getUserId throws away — WHERE the id came from — so the API guard can
// refuse guests on routes that are for signed-up users only.
describe('getRequester', () => {
  it('reports a session user as not a guest', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'real-user' } })
    await expect(getRequester()).resolves.toEqual({ userId: 'real-user', isGuest: false })
  })

  it('reports a validated cookie as a guest', async () => {
    getServerSession.mockResolvedValue(null)
    cookieGet.mockReturnValue({ value: 'guest-1' })
    findUnique.mockResolvedValue({ email: 'guest-1@lunastak.local' })
    await expect(getRequester()).resolves.toEqual({ userId: 'guest-1', isGuest: true })
  })

  it('returns null for a cookie naming a real user', async () => {
    getServerSession.mockResolvedValue(null)
    cookieGet.mockReturnValue({ value: 'someone-elses-id' })
    findUnique.mockResolvedValue({ email: 'someone@example.com' })
    await expect(getRequester()).resolves.toBeNull()
  })

  it('returns null when there is neither', async () => {
    getServerSession.mockResolvedValue(null)
    cookieGet.mockReturnValue(undefined)
    await expect(getRequester()).resolves.toBeNull()
  })
})
