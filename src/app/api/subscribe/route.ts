/**
 * Subscribe endpoint - adds email to audience and redirects to sign-in
 *
 * Single-step subscription: adds contact to Resend audience (subscribed)
 * and returns redirect URL to sign-in page for magic link authentication.
 *
 * Works from any context (before/after strategy creation).
 */
import { NextRequest, NextResponse } from 'next/server'
import { resend, EMAIL_CONFIG } from '@/lib/resend'

interface SubscribeData {
  email: string
  name?: string
  guestUserId?: string // Optional: for session transfer after auth
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscribeData = await request.json()
    const { email, name, guestUserId } = body

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Add contact to Resend audience as subscribed (single opt-in)
    try {
      await resend.contacts.create({
        email,
        firstName: name?.split(' ')[0] || undefined,
        lastName: name?.split(' ').slice(1).join(' ') || undefined,
        unsubscribed: false, // Subscribed directly
        audienceId: process.env.RESEND_AUDIENCE_ID as string,
      })
    } catch (error: any) {
      // Contact may already exist - that's fine, update to subscribed
      if (error?.message?.includes('already exists')) {
        try {
          await resend.contacts.update({
            email,
            unsubscribed: false,
            audienceId: process.env.RESEND_AUDIENCE_ID as string,
          })
        } catch (updateError) {
          console.error('Error updating contact:', updateError)
        }
      } else {
        console.error('Error creating contact:', error)
      }
    }

    // Notify admin
    try {
      await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: EMAIL_CONFIG.adminEmail,
        subject: 'New Lunastak App Signup',
        text: `
New app signup:

Email: ${email}
Name: ${name || 'Not provided'}
Guest User ID: ${guestUserId || 'None'}
        `.trim(),
      })
    } catch (emailError) {
      // Don't fail the request if admin notification fails
      console.error('Error sending admin notification:', emailError)
    }

    // Build redirect URL to sign-in page with auto-submit
    // Use VERCEL_URL for preview deployments, custom domain for production
    const baseUrl = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    const signInUrl = new URL('/auth/signin', baseUrl)
    signInUrl.searchParams.set('email', email)
    signInUrl.searchParams.set('confirmed', 'true') // Auto-submit to send magic link
    if (guestUserId) {
      signInUrl.searchParams.set('callbackUrl', '/')
    }

    return NextResponse.json({
      success: true,
      redirectUrl: signInUrl.toString(),
      message: 'Redirecting to sign in...'
    })
  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process request. Please try again later.' },
      { status: 500 }
    )
  }
}
