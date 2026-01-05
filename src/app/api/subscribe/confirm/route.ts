/**
 * Subscribe confirmation endpoint - confirms email and redirects to sign-in
 *
 * This is the second step of the double opt-in flow for in-app signup.
 * After clicking the confirmation link, the user's email is verified
 * and they're redirected to sign in (which sends the magic link).
 *
 * NOTE: This is a duplicate implementation from the marketing site
 * (lunastak.io/app/api/early-access/confirm/route.ts).
 * Both endpoints use the same Resend audience and encryption key.
 * If updating this file, consider whether the marketing site also needs updating.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { decrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    const baseUrl = request.nextUrl.origin

    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin?error=missing-token', baseUrl))
    }

    // Decrypt and parse the token
    let email: string
    let timestamp: number
    let conversationId: string | null = null

    try {
      const decryptedToken = decrypt(token)
      const data = JSON.parse(decryptedToken)
      email = data.email
      timestamp = data.timestamp
      conversationId = data.conversationId || null
    } catch (error) {
      console.error('Token decryption error:', error)
      return NextResponse.redirect(new URL('/auth/signin?error=invalid-token', baseUrl))
    }

    // Check if the token is expired (24 hours)
    const tokenAge = Date.now() - timestamp
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(new URL('/auth/signin?error=token-expired', baseUrl))
    }

    // Update contact status to subscribed in Resend audience
    try {
      await resend.contacts.update({
        email,
        unsubscribed: false,
        audienceId: process.env.RESEND_AUDIENCE_ID as string,
      })
    } catch (error) {
      console.error('Error updating contact:', error)
      // Continue anyway - they can still sign in
    }

    // Build redirect URL with pre-filled email
    const signInUrl = new URL('/auth/signin', baseUrl)
    signInUrl.searchParams.set('email', email)
    signInUrl.searchParams.set('confirmed', 'true')

    // If there's a conversation to transfer, include it
    if (conversationId) {
      signInUrl.searchParams.set('transfer', conversationId)
    }

    return NextResponse.redirect(signInUrl)
  } catch (error) {
    console.error('Subscribe confirmation error:', error)
    return NextResponse.redirect(
      new URL('/auth/signin?error=confirmation-failed', request.nextUrl.origin)
    )
  }
}
