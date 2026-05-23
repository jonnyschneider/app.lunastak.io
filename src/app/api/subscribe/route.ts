/**
 * Subscribe endpoint — captures email pre-auth, adds to Resend audience,
 * and redirects to sign-in for magic link authentication.
 *
 * Side-effects (audience add, admin notify) are owned by the signup orchestrator.
 */
import { NextRequest, NextResponse } from 'next/server'
import { onSubscribe } from '@/lib/signup-orchestrator'

interface SubscribeData {
  email: string
  name?: string
  guestUserId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscribeData = await request.json()
    const { email, name, guestUserId } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Delegate to orchestrator (handles audience + admin notify, never throws)
    await onSubscribe({ email, name, guestUserId })

    // Build redirect URL to sign-in page with auto-submit
    const baseUrl = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

    const signInUrl = new URL('/auth/signin', baseUrl)
    signInUrl.searchParams.set('email', email)
    signInUrl.searchParams.set('confirmed', 'true')
    if (guestUserId) {
      signInUrl.searchParams.set('callbackUrl', '/')
    }

    return NextResponse.json({
      success: true,
      redirectUrl: signInUrl.toString(),
      message: 'Redirecting to sign in...',
    })
  } catch (error) {
    console.error('[Subscribe] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request. Please try again later.' },
      { status: 500 }
    )
  }
}
