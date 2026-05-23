/**
 * Signup orchestrator.
 *
 * Single canonical place for signup/sign-in side-effects.
 * Called from NextAuth events.signIn and from /api/subscribe.
 *
 * Failure-tolerant: each side-effect is wrapped so one failure doesn't block others.
 * None of these functions throw — they log and continue.
 */
import { resend, EMAIL_CONFIG } from '@/lib/resend'
import { renderEmail } from '@/lib/render-email'
import { WelcomeEmail } from '@/emails/transactional/welcome'
import { notifySlackNewUser, notifySlackUserSignIn } from '@/lib/notifications'
import { logStatsigEvent } from '@/lib/statsig'
import { transferGuestToUser } from '@/lib/transfer-session'
import { prisma } from '@/lib/db'
import type {
  SubscribeContext,
  SignupContext,
  SignInContext,
} from '@/lib/contracts/signup'

const DAY_MS = 24 * 60 * 60 * 1000

function splitName(name?: string): { firstName?: string; lastName?: string } {
  if (!name) return {}
  const parts = name.trim().split(/\s+/)
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || undefined,
  }
}

async function addToAudience(email: string, name?: string): Promise<void> {
  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) {
    console.error('[Orchestrator] RESEND_AUDIENCE_ID not set; skipping audience add')
    return
  }

  const { firstName, lastName } = splitName(name)

  try {
    await resend.contacts.create({
      email,
      firstName,
      lastName,
      unsubscribed: false,
      audienceId,
    })
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      try {
        await resend.contacts.update({ email, unsubscribed: false, audienceId })
      } catch (updateError) {
        console.error('[Orchestrator] Failed to re-subscribe contact:', updateError)
      }
    } else {
      console.error('[Orchestrator] Failed to add contact to audience:', error)
    }
  }
}

async function notifyAdmin(subject: string, body: string): Promise<void> {
  try {
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject,
      text: body,
    })
  } catch (error) {
    console.error('[Orchestrator] Failed to send admin notification:', error)
  }
}

async function sendWelcomeEmail(email: string, firstName?: string): Promise<void> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.lunastak.io'
    const html = await renderEmail(WelcomeEmail({ appUrl, firstName }))
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      replyTo: EMAIL_CONFIG.replyTo,
      to: email,
      subject: 'Welcome to Lunastak',
      html,
    })
  } catch (error) {
    console.error('[Orchestrator] Failed to send welcome email:', error)
  }
}

/**
 * onSubscribe — email captured pre-auth.
 * Adds to audience + admin notify. No welcome email yet.
 */
export async function onSubscribe(input: SubscribeContext): Promise<void> {
  try {
    await addToAudience(input.email, input.name)
    await notifyAdmin(
      '[Lunastak] New Subscribe',
      `New subscribe (pre-auth):\nEmail: ${input.email}\nName: ${input.name ?? '(none)'}\nGuest user: ${input.guestUserId ?? '(none)'}`
    )
  } catch (error) {
    console.error('[Orchestrator] onSubscribe failed:', error)
  }
}

/**
 * onSignup — first successful sign-in for a brand-new user.
 * Fires from NextAuth events.signIn when isNewUser=true.
 */
export async function onSignup(input: SignupContext): Promise<void> {
  const { firstName } = splitName(input.name)

  // Audience add (in case onSubscribe didn't run for this email yet)
  try {
    await addToAudience(input.email, input.name)
  } catch (e) {
    console.error('[Orchestrator] onSignup audience failed:', e)
  }

  // Welcome email
  try {
    await sendWelcomeEmail(input.email, firstName)
  } catch (e) {
    console.error('[Orchestrator] onSignup welcome failed:', e)
  }

  // Admin notify
  try {
    await notifyAdmin(
      '[Lunastak] New User Signup',
      `New user signed up:\nEmail: ${input.email}\nName: ${input.name ?? '(none)'}\nProvider: ${input.provider}\nSource: ${input.source}\nUser ID: ${input.userId}`
    )
  } catch (e) {
    console.error('[Orchestrator] onSignup admin notify failed:', e)
  }

  // Slack
  try {
    notifySlackNewUser(input.email)
  } catch (e) {
    console.error('[Orchestrator] onSignup Slack failed:', e)
  }

  // Statsig
  try {
    await logStatsigEvent(input.userId, 'account_created', undefined, {
      provider: input.provider,
      source: input.source,
      userType: 'signed_up',
    })
  } catch (e) {
    console.error('[Orchestrator] onSignup Statsig failed:', e)
  }
}

/**
 * onSignIn — every sign-in (new or returning).
 * For isNewUser=true, onSignup has already fired separately.
 */
export async function onSignIn(input: SignInContext): Promise<void> {
  // Returning-user signals (skip when this is a brand-new user — they get the new-user signals via onSignup)
  if (!input.isNewUser) {
    try {
      notifySlackUserSignIn(input.email, false)
    } catch (e) {
      console.error('[Orchestrator] onSignIn Slack failed:', e)
    }

    try {
      await logStatsigEvent(input.userId, 'account_signed_in', undefined, {
        provider: input.provider,
        userType: 'signed_up',
      })
    } catch (e) {
      console.error('[Orchestrator] onSignIn Statsig failed:', e)
    }
  }

  // PendingGuestTransfer recovery — runs for every sign-in (cross-device flow)
  try {
    const pending = await prisma.pendingGuestTransfer.findFirst({
      where: { email: input.email.toLowerCase() },
    })

    if (pending) {
      console.log(`[Orchestrator] Found pending transfer for ${input.email}: guest ${pending.guestUserId}`)
      await transferGuestToUser(pending.guestUserId, input.userId)
      await prisma.pendingGuestTransfer.delete({ where: { id: pending.id } })
    }

    // Clean up stale transfers (>24h)
    await prisma.pendingGuestTransfer.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - DAY_MS) } },
    })
  } catch (error) {
    console.error('[Orchestrator] Pending transfer recovery failed:', error)
  }
}
