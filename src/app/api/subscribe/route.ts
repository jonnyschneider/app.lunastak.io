/**
 * Subscribe endpoint - captures email and sends confirmation
 *
 * This is the first step of the double opt-in flow for in-app signup.
 * Users use the app as guests, then subscribe when ready to save their strategy.
 *
 * NOTE: This is a duplicate implementation from the marketing site
 * (lunastak.io/app/api/early-access/route.ts).
 * Both endpoints use the same Resend audience and encryption key.
 * If updating this file, consider whether the marketing site also needs updating.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resend, EMAIL_CONFIG } from '@/lib/resend'
import { encrypt } from '@/lib/crypto'
import { renderSubscribeConfirmEmail } from '@/lib/render-email'

interface SubscribeData {
  email: string
  name?: string
  conversationId?: string // Optional: link to guest conversation for session transfer
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscribeData = await request.json()
    const { email, name, conversationId } = body

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Add contact to Resend audience as unsubscribed (pending confirmation)
    try {
      await resend.contacts.create({
        email,
        firstName: name?.split(' ')[0] || undefined,
        lastName: name?.split(' ').slice(1).join(' ') || undefined,
        unsubscribed: true,
        audienceId: process.env.RESEND_AUDIENCE_ID as string,
      })
    } catch (error: any) {
      // Contact may already exist - that's fine
      if (!error?.message?.includes('already exists')) {
        console.error('Error creating contact:', error)
      }
    }

    // Generate confirmation token with encrypted data
    const tokenData = JSON.stringify({
      email,
      name: name || null,
      conversationId: conversationId || null,
      timestamp: Date.now(),
      source: 'lunastak-app-subscribe'
    })
    const token = encrypt(tokenData)

    const confirmationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/subscribe/confirm?token=${encodeURIComponent(token)}`

    // Render and send confirmation email
    const confirmationEmailHtml = await renderSubscribeConfirmEmail(confirmationLink)

    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: email,
      replyTo: EMAIL_CONFIG.replyTo,
      subject: 'Confirm your Lunastak account',
      html: confirmationEmailHtml,
    })

    // Notify admin (optional - can be removed for high volume)
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.adminEmail,
      subject: 'New Lunastak App Signup',
      text: `
New app signup request:

Email: ${email}
Name: ${name || 'Not provided'}
Conversation ID: ${conversationId || 'None'}
Status: Pending confirmation
      `.trim(),
    })

    return NextResponse.json({
      success: true,
      message: 'Please check your email to confirm your account'
    })
  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process request. Please try again later.' },
      { status: 500 }
    )
  }
}
