import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(function (this: unknown, secret: string) {
    return {
      verify: (payload: string) => {
        if (secret === 'good-secret') {
          return JSON.parse(payload)
        }
        throw new Error('Invalid signature')
      },
    }
  }),
}))

vi.mock('@/lib/resend', () => ({
  resend: {
    contacts: { update: vi.fn().mockResolvedValue({}) },
    emails: { send: vi.fn().mockResolvedValue({}) },
  },
  EMAIL_CONFIG: {
    from: 'Lunastak <luna@lunastak.io>',
    adminEmail: 'jonny@humventures.com.au',
  },
}))

import { POST } from '@/app/api/email/webhook/route'
import { resend } from '@/lib/resend'

function makeRequest(payload: object, secretMatches: boolean): Request {
  const body = JSON.stringify(payload)
  return new Request('http://localhost/api/email/webhook', {
    method: 'POST',
    body,
    headers: {
      'svix-id': 'msg_test',
      'svix-timestamp': String(Date.now()),
      'svix-signature': secretMatches ? 'sig_good' : 'sig_bad',
      'content-type': 'application/json',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_WEBHOOK_SECRET = 'good-secret'
  process.env.RESEND_AUDIENCE_ID = 'audience-test'
})

describe('POST /api/email/webhook', () => {
  it('returns 401 on invalid signature', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'wrong-secret'
    const req = makeRequest({ type: 'email.bounced', data: { to: 'a@b.com' } }, true)
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    expect(resend.contacts.update).not.toHaveBeenCalled()
  })

  it('returns 500 when RESEND_WEBHOOK_SECRET is unset', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    const req = makeRequest({ type: 'email.bounced', data: { to: 'a@b.com' } }, true)
    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })

  it('unsubscribes on permanent bounce', async () => {
    const req = makeRequest(
      {
        type: 'email.bounced',
        created_at: '2026-05-23T10:00:00Z',
        data: { to: 'bouncer@example.com', subject: 'Test', bounce: { type: 'Permanent', message: 'mailbox does not exist', subType: 'General' } },
      },
      true
    )
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(resend.contacts.update).toHaveBeenCalledWith({
      email: 'bouncer@example.com',
      unsubscribed: true,
      audienceId: 'audience-test',
    })
    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jonny@humventures.com.au',
        subject: expect.stringMatching(/bounce/i),
      })
    )
  })

  it('does NOT unsubscribe on soft bounce', async () => {
    const req = makeRequest(
      {
        type: 'email.bounced',
        data: { to: 'soft@example.com', bounce: { type: 'Transient', message: 'temp fail', subType: 'General' } },
      },
      true
    )
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(resend.contacts.update).not.toHaveBeenCalled()
  })

  it('unsubscribes on complaint', async () => {
    const req = makeRequest(
      { type: 'email.complained', data: { to: 'complainer@example.com', subject: 'X' } },
      true
    )
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(resend.contacts.update).toHaveBeenCalledWith({
      email: 'complainer@example.com',
      unsubscribed: true,
      audienceId: 'audience-test',
    })
  })

  it('ignores unhandled event types without erroring', async () => {
    const req = makeRequest({ type: 'email.opened', data: { to: 'opener@example.com' } }, true)
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(resend.contacts.update).not.toHaveBeenCalled()
  })
})
