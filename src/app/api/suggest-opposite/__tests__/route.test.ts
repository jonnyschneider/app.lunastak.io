// @vitest-environment node
/**
 * POST /api/suggest-opposite — any requester (guests included: PrinciplesSection is on the
 * guest-reachable template page), nobody anonymous.
 *
 * Until 2026-09-11 this was an open LLM proxy: no auth, and an unbounded string interpolated into
 * the prompt. Guests are deliberately NOT metered here (auth-gap plan D4) — `apiCallCount` is the
 * guest quota, and charging it for a 2-4 word suggestion would be a product change.
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  createMessage: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/claude', () => ({ createMessage: mocks.createMessage }))

import { POST } from '../route'

const post = (body: unknown) =>
  POST(new Request('http://x/api/suggest-opposite', { method: 'POST', body: JSON.stringify(body) }) as never)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRequester.mockResolvedValue({ userId: 'guest-1', isGuest: true })
  mocks.createMessage.mockResolvedValue({ content: [{ type: 'text', text: ' Premium pricing \n' }] })
})

it('anonymous → 401, without spending an LLM call', async () => {
  mocks.getRequester.mockResolvedValue(null)
  expect((await post({ priority: 'Ubiquity' })).status).toBe(401)
  expect(mocks.createMessage).not.toHaveBeenCalled()
})

it('a priority over 200 chars → 400, without spending an LLM call', async () => {
  expect((await post({ priority: 'x'.repeat(201) })).status).toBe(400)
  expect(mocks.createMessage).not.toHaveBeenCalled()
})

it('a guest gets a suggestion — and is not metered (no userId reaches createMessage)', async () => {
  const res = await post({ priority: 'x'.repeat(200) })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ opposite: 'Premium pricing' })
  expect(mocks.createMessage).toHaveBeenCalledTimes(1)
  // createMessage(params, callSite, userId?) — a third argument would burn the guest quota.
  expect(mocks.createMessage.mock.calls[0]).toHaveLength(2)
})
