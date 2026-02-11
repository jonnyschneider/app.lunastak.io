import { NextResponse } from 'next/server'
import { resend, EMAIL_CONFIG } from '@/lib/resend'

export async function POST(request: Request) {
  try {
    const { email, feature } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Send notification to admin
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject: `[Waitlist] Early access signup: ${feature || 'Pro features'}`,
      text: `
New early access waitlist signup:

Email: ${email}
Feature interest: ${feature || 'General Pro features'}
Time: ${new Date().toISOString()}
      `.trim(),
    })

    // Send confirmation to user
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      replyTo: EMAIL_CONFIG.replyTo,
      to: email,
      subject: "You're on the early access list!",
      text: `
Hey there!

Thanks for joining the Lunastak early access list. We'll let you know as soon as new Pro features are ready.

In the meantime, keep using Lunastak to refine your strategy - your feedback helps us build the right things.

Cheers,
Luna

--
Lunastak - AI Strategy Coach
      `.trim(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Waitlist] Error:', error)
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    )
  }
}
