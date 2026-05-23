import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { resend, EMAIL_CONFIG } from '@/lib/resend'

/**
 * Resend webhook handler.
 *
 * Handles:
 * - email.bounced (Permanent → auto-unsubscribe)
 * - email.complained (auto-unsubscribe)
 *
 * Setup:
 * 1. Add RESEND_WEBHOOK_SECRET (whsec_…) to env.
 * 2. Register `https://app.lunastak.io/api/email/webhook` in Resend dashboard.
 * 3. Subscribe to email.bounced and email.complained events.
 */

interface ResendWebhookEvent {
  type: string
  created_at?: string
  data: {
    email_id?: string
    to?: string | string[]
    subject?: string
    bounce?: { type: string; subType: string; message: string }
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const headers = {
      'svix-id': request.headers.get('svix-id') || '',
      'svix-timestamp': request.headers.get('svix-timestamp') || '',
      'svix-signature': request.headers.get('svix-signature') || '',
    }

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Email Webhook] RESEND_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const wh = new Webhook(webhookSecret)
    let event: ResendWebhookEvent
    try {
      event = wh.verify(payload, headers) as ResendWebhookEvent
    } catch (error) {
      console.error('[Email Webhook] Verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    console.log(`[Email Webhook] Event: ${event.type}`)

    switch (event.type) {
      case 'email.bounced':
        await handleBounce(event)
        break
      case 'email.complained':
        await handleComplaint(event)
        break
      default:
        console.log(`[Email Webhook] Ignored event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Email Webhook] Processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function recipientEmail(event: ResendWebhookEvent): string | undefined {
  return Array.isArray(event.data.to) ? event.data.to[0] : event.data.to
}

type UnsubscribeResult = 'unsubscribed' | 'not_in_audience' | 'error'

/**
 * Unsubscribes a contact from the audience.
 *
 * The Resend SDK returns `{ data, error }` and does NOT throw on API errors,
 * so we must inspect `.error` explicitly — otherwise failures (e.g. a contact
 * that isn't in the audience → 404) pass silently.
 */
async function unsubscribeFromAudience(email: string, audienceId: string): Promise<UnsubscribeResult> {
  try {
    const { error } = await resend.contacts.update({ email, unsubscribed: true, audienceId })
    if (error) {
      if (error.name === 'not_found' || /not found/i.test(error.message ?? '')) {
        console.warn(`[Email Webhook] ${email} not in audience ${audienceId}; nothing to unsubscribe`)
        return 'not_in_audience'
      }
      console.error(`[Email Webhook] contacts.update failed for ${email} (audience ${audienceId}):`, error)
      return 'error'
    }
    console.log(`[Email Webhook] Unsubscribed ${email} from audience ${audienceId}`)
    return 'unsubscribed'
  } catch (err) {
    console.error(`[Email Webhook] contacts.update threw for ${email}:`, err)
    return 'error'
  }
}

const RESULT_SUFFIX: Record<UnsubscribeResult, string> = {
  unsubscribed: 'email unsubscribed',
  not_in_audience: 'contact not in audience',
  error: 'unsubscribe failed',
}

/** Sends the admin notification independently of the unsubscribe outcome. */
async function notifyAdmin(subject: string, text: string): Promise<void> {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject,
      text,
    })
    if (error) {
      console.error('[Email Webhook] admin notification failed:', error)
      return
    }
    console.log(`[Email Webhook] Admin notified: ${data?.id}`)
  } catch (err) {
    console.error('[Email Webhook] admin notification threw:', err)
  }
}

async function handleBounce(event: ResendWebhookEvent) {
  const email = recipientEmail(event)
  if (!email) return console.error('[Email Webhook] No address in bounce')

  const bounceType = event.data.bounce?.type
  const bounceReason = event.data.bounce?.message ?? 'Unknown'

  if (bounceType !== 'Permanent') {
    console.log(`[Email Webhook] Soft bounce for ${email} (type=${bounceType ?? 'unknown'}), not unsubscribing`)
    return
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) return console.error('[Email Webhook] RESEND_AUDIENCE_ID not configured')

  const result = await unsubscribeFromAudience(email, audienceId)
  await notifyAdmin(
    `[Lunastak] Hard bounce — ${RESULT_SUFFIX[result]}`,
    `Email: ${email}\nAudience: ${audienceId}\nUnsubscribe: ${result}\nReason: ${bounceReason}\nSubject: ${event.data.subject ?? 'N/A'}\nTime: ${event.created_at ?? 'N/A'}`,
  )
}

async function handleComplaint(event: ResendWebhookEvent) {
  const email = recipientEmail(event)
  if (!email) return console.error('[Email Webhook] No address in complaint')

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) return console.error('[Email Webhook] RESEND_AUDIENCE_ID not configured')

  const result = await unsubscribeFromAudience(email, audienceId)
  await notifyAdmin(
    `[Lunastak] Spam complaint — ${RESULT_SUFFIX[result]}`,
    `Email: ${email}\nAudience: ${audienceId}\nUnsubscribe: ${result}\nSubject: ${event.data.subject ?? 'N/A'}\nTime: ${event.created_at ?? 'N/A'}`,
  )
}
