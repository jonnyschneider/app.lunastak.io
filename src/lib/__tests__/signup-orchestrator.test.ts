import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the modules used by the orchestrator
vi.mock('@/lib/resend', () => ({
  resend: {
    contacts: {
      create: vi.fn(),
      update: vi.fn(),
    },
    emails: {
      send: vi.fn(),
    },
  },
  EMAIL_CONFIG: {
    from: 'Lunastak <luna@lunastak.io>',
    replyTo: 'luna@lunastak.io',
    adminEmail: 'jonny@humventures.com.au',
  },
}))

vi.mock('@/lib/notifications', () => ({
  notifySlackNewUser: vi.fn(),
  notifySlackUserSignIn: vi.fn(),
}))

vi.mock('@/lib/statsig', () => ({
  logStatsigEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/transfer-session', () => ({
  transferGuestToUser: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    pendingGuestTransfer: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { onSubscribe, onSignup, onSignIn } from '@/lib/signup-orchestrator'
import { resend } from '@/lib/resend'
import { notifySlackNewUser, notifySlackUserSignIn } from '@/lib/notifications'
import { logStatsigEvent } from '@/lib/statsig'
import { transferGuestToUser } from '@/lib/transfer-session'
import { prisma } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_AUDIENCE_ID = 'audience-test'
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.lunastak.io'
})

describe('onSubscribe', () => {
  it('adds the contact to the audience as subscribed', async () => {
    ;(resend.contacts.create as any).mockResolvedValue({})
    await onSubscribe({ email: 'new@example.com', name: 'New User' })

    expect(resend.contacts.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      unsubscribed: false,
      audienceId: 'audience-test',
    })
  })

  it('falls back to update when the contact already exists', async () => {
    ;(resend.contacts.create as any).mockRejectedValue(new Error('already exists'))
    await onSubscribe({ email: 'existing@example.com' })

    expect(resend.contacts.update).toHaveBeenCalledWith({
      email: 'existing@example.com',
      unsubscribed: false,
      audienceId: 'audience-test',
    })
  })

  it('sends an admin notification email', async () => {
    ;(resend.contacts.create as any).mockResolvedValue({})
    await onSubscribe({ email: 'admin-notify@example.com' })

    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jonny@humventures.com.au',
        subject: expect.stringContaining('Subscribe'),
      })
    )
  })

  it('does NOT send a welcome email', async () => {
    ;(resend.contacts.create as any).mockResolvedValue({})
    await onSubscribe({ email: 'no-welcome@example.com' })

    const calls = (resend.emails.send as any).mock.calls
    expect(calls.every((c: any[]) => !String(c[0]?.subject ?? '').toLowerCase().includes('welcome'))).toBe(true)
  })

  it('does not throw if audience-add fails for unknown reasons', async () => {
    ;(resend.contacts.create as any).mockRejectedValue(new Error('network error'))
    await expect(onSubscribe({ email: 'fail@example.com' })).resolves.toBeUndefined()
  })
})

describe('onSignup', () => {
  beforeEach(() => {
    ;(resend.contacts.create as any).mockResolvedValue({})
    ;(resend.emails.send as any).mockResolvedValue({ data: { id: 'email-id' } })
  })

  const ctx = {
    userId: 'u_1',
    email: 'newuser@example.com',
    name: 'New User',
    provider: 'google' as const,
    source: 'nextauth' as const,
  }

  it('adds the user to the Resend audience', async () => {
    await onSignup(ctx)
    expect(resend.contacts.create).toHaveBeenCalled()
  })

  it('sends a welcome email', async () => {
    await onSignup(ctx)
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newuser@example.com',
        subject: expect.stringMatching(/welcome/i),
        html: expect.any(String),
      })
    )
  })

  it('sends an admin notification', async () => {
    await onSignup(ctx)
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'jonny@humventures.com.au' })
    )
  })

  it('pings Slack with new-user notification', async () => {
    await onSignup(ctx)
    expect(notifySlackNewUser).toHaveBeenCalledWith('newuser@example.com')
  })

  it('logs Statsig account_created event', async () => {
    await onSignup(ctx)
    expect(logStatsigEvent).toHaveBeenCalledWith(
      'u_1',
      'account_created',
      undefined,
      expect.objectContaining({ provider: 'google' })
    )
  })

  it('continues running if audience-add throws', async () => {
    ;(resend.contacts.create as any).mockRejectedValue(new Error('boom'))
    await onSignup(ctx)
    expect(notifySlackNewUser).toHaveBeenCalled()
    expect(logStatsigEvent).toHaveBeenCalled()
  })

  it('continues running if welcome email throws', async () => {
    ;(resend.emails.send as any).mockRejectedValue(new Error('email boom'))
    await onSignup(ctx)
    expect(notifySlackNewUser).toHaveBeenCalled()
  })

  it('never throws', async () => {
    ;(resend.contacts.create as any).mockRejectedValue(new Error('x'))
    ;(resend.emails.send as any).mockRejectedValue(new Error('y'))
    ;(notifySlackNewUser as any).mockImplementation(() => { throw new Error('z') })
    await expect(onSignup(ctx)).resolves.toBeUndefined()
  })
})

describe('onSignIn', () => {
  const ctx = {
    userId: 'u_2',
    email: 'existing@example.com',
    isNewUser: false,
    provider: 'email' as const,
  }

  it('logs Statsig account_signed_in for returning users', async () => {
    ;(prisma.pendingGuestTransfer.findFirst as any).mockResolvedValue(null)
    await onSignIn(ctx)
    expect(logStatsigEvent).toHaveBeenCalledWith(
      'u_2',
      'account_signed_in',
      undefined,
      expect.objectContaining({ provider: 'email' })
    )
  })

  it('pings Slack with returning-user notification when isNewUser=false', async () => {
    ;(prisma.pendingGuestTransfer.findFirst as any).mockResolvedValue(null)
    await onSignIn(ctx)
    expect(notifySlackUserSignIn).toHaveBeenCalledWith('existing@example.com', false)
  })

  it('skips Statsig account_signed_in when isNewUser=true (onSignup will fire instead)', async () => {
    ;(prisma.pendingGuestTransfer.findFirst as any).mockResolvedValue(null)
    await onSignIn({ ...ctx, isNewUser: true })
    expect(logStatsigEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      'account_signed_in',
      expect.anything(),
      expect.anything()
    )
  })

  it('runs PendingGuestTransfer recovery when a pending transfer exists', async () => {
    ;(prisma.pendingGuestTransfer.findFirst as any).mockResolvedValue({
      id: 'pgt_1',
      email: 'existing@example.com',
      guestUserId: 'guest_42',
    })
    await onSignIn(ctx)
    expect(transferGuestToUser).toHaveBeenCalledWith('guest_42', 'u_2')
    expect(prisma.pendingGuestTransfer.delete).toHaveBeenCalledWith({ where: { id: 'pgt_1' } })
  })

  it('cleans up stale (>24h) pending transfers', async () => {
    ;(prisma.pendingGuestTransfer.findFirst as any).mockResolvedValue(null)
    await onSignIn(ctx)
    expect(prisma.pendingGuestTransfer.deleteMany).toHaveBeenCalled()
  })

  it('does not throw if transfer recovery fails', async () => {
    ;(prisma.pendingGuestTransfer.findFirst as any).mockRejectedValue(new Error('db down'))
    await expect(onSignIn(ctx)).resolves.toBeUndefined()
  })
})
