/**
 * The browser follows the database user. A guest who signs up must start afresh as the new
 * account — PostHog refuses to re-identify an identified person — and the server merges the rest.
 */

const state = { distinctId: 'anon-device', userState: 'anonymous' }

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  get_distinct_id: vi.fn(),
  get_property: vi.fn(),
  reset: vi.fn(),
  identify: vi.fn(),
}))

vi.mock('posthog-js', () => ({ default: ph }))

import { initPostHog, identifyPostHog } from '@/lib/analytics/posthog-client'

beforeAll(() => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
  initPostHog()
})

beforeEach(() => {
  vi.clearAllMocks()
  ph.get_distinct_id.mockImplementation(() => state.distinctId)
  ph.get_property.mockImplementation((p: string) => (p === '$user_state' ? state.userState : undefined))
  ph.reset.mockImplementation(() => { state.distinctId = 'new-anon'; state.userState = 'anonymous' })
  ph.identify.mockImplementation((id: string) => { state.distinctId = id; state.userState = 'identified' })
})

it('identifies an anonymous visitor as their guest row, keeping the device history', () => {
  identifyPostHog('guest-1', 'guest', 'guest_x@guest.lunastak.io')

  expect(ph.reset).not.toHaveBeenCalled()
  expect(ph.identify).toHaveBeenCalledWith('guest-1', { userType: 'guest' })
})

it('does nothing more when the id has not changed', () => {
  identifyPostHog('guest-1', 'guest')
  expect(ph.identify).not.toHaveBeenCalled()
})

it('starts afresh when a guest comes back as a signed-up account', () => {
  identifyPostHog('user-1', 'signed_up', 'a@b.com')

  expect(ph.reset).toHaveBeenCalledOnce()
  expect(ph.identify).toHaveBeenCalledWith('user-1', { userType: 'signed_up', email: 'a@b.com' })
})
