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

async function handleBounce(event: ResendWebhookEvent) {
  const email = recipientEmail(event)
  if (!email) return console.error('[Email Webhook] No address in bounce')

  const bounceType = event.data.bounce?.type
  const bounceReason = event.data.bounce?.message ?? 'Unknown'

  if (bounceType !== 'Permanent') {
    console.log(`[Email Webhook] Soft bounce for ${email}, not unsubscribing`)
    return
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) return console.error('[Email Webhook] RESEND_AUDIENCE_ID not configured')

  try {
    await resend.contacts.update({ email, unsubscribed: true, audienceId })
    console.log(`[Email Webhook] Unsubscribed bounced: ${email}`)

    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject: '[Lunastak] Hard bounce — email unsubscribed',
      text: `Email: ${email}\nReason: ${bounceReason}\nSubject: ${event.data.subject ?? 'N/A'}\nTime: ${event.created_at ?? 'N/A'}`,
    })
  } catch (error) {
    console.error(`[Email Webhook] Failed unsubscribing ${email}:`, error)
  }
}

async function handleComplaint(event: ResendWebhookEvent) {
  const email = recipientEmail(event)
  if (!email) return console.error('[Email Webhook] No address in complaint')

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) return console.error('[Email Webhook] RESEND_AUDIENCE_ID not configured')

  try {
    await resend.contacts.update({ email, unsubscribed: true, audienceId })
    console.log(`[Email Webhook] Unsubscribed complainant: ${email}`)

    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject: '[Lunastak] Spam complaint — email unsubscribed',
      text: `Email: ${email}\nSubject: ${event.data.subject ?? 'N/A'}\nTime: ${event.created_at ?? 'N/A'}`,
    })
  } catch (error) {
    console.error(`[Email Webhook] Failed unsubscribing ${email}:`, error)
  }
}
