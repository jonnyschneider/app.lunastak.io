/**
 * PostHog runs alongside Statsig: every server event reaches both under the same user id, and a
 * guest's person is folded into their account only after the data transfer has committed.
 */

const captured: { distinctId: string; event: string; properties?: Record<string, unknown> }[] = []

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture(msg: (typeof captured)[number]) { captured.push(msg) }
    async flush() {}
  },
}))

vi.mock('statsig-node', () => ({
  __esModule: true,
  default: {
    initialize: vi.fn().mockResolvedValue(undefined),
    logEvent: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  },
}))

const tx = {
  project: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  conversation: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  trace: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  feedback: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  userDismissal: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
}

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    project: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  },
}))

import { prisma } from '@/lib/db'
import { logStatsigEvent } from '@/lib/statsig'
import { transferGuestToUser } from '@/lib/transfer-session'

const GUEST_EMAIL = 'guest_abc@guest.lunastak.io'

beforeEach(() => {
  captured.length = 0
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
})

describe('server events', () => {
  it('reach PostHog under the same user id, with Statsig\'s value as a property', async () => {
    await logStatsigEvent('user-1', 'strategy_generated', 1, { variant: 'e3' })

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      distinctId: 'user-1',
      event: 'strategy_generated',
      properties: { variant: 'e3', value: 1 },
    })
  })

  it('reach PostHog even when Statsig is not configured', async () => {
    delete process.env.STATSIG_SERVER_SECRET_KEY
    await logStatsigEvent('user-1', 'account_created')
    expect(captured.map(c => c.event)).toEqual(['account_created'])
  })
})

describe('guest → user merge', () => {
  it('folds the guest into the account once the transfer commits', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: GUEST_EMAIL } as never)

    await transferGuestToUser('guest-1', 'user-1')

    expect(captured).toContainEqual(expect.objectContaining({
      distinctId: 'user-1',
      event: '$merge_dangerously',
      properties: expect.objectContaining({ alias: 'guest-1' }),
    }))
  })

  it('does not merge when the transfer rolls back', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: GUEST_EMAIL } as never)
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('rollback'))

    await expect(transferGuestToUser('guest-1', 'user-1')).rejects.toThrow('rollback')
    expect(captured).toHaveLength(0)
  })

  it('does not merge a real account into another', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'someone@example.com' } as never)

    await transferGuestToUser('user-2', 'user-1')
    expect(captured).toHaveLength(0)
  })
})
