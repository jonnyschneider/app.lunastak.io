/**
 * Resend email client and configuration
 *
 * NOTE: This is a duplicate implementation from the marketing site (lunastak.io/lib/resend.ts).
 * Both sites share the same Resend account and audience.
 * If updating this file, consider whether the marketing site also needs updating.
 */
import { Resend } from 'resend'

// Lazy initialization to avoid errors when API key not needed
let _resend: Resend | null = null

export const resend = new Proxy({} as Resend, {
  get(target, prop) {
    if (!_resend) {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY environment variable is not set')
      }
      _resend = new Resend(process.env.RESEND_API_KEY)
    }
    return (_resend as any)[prop]
  }
})

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'Lunastak <hello@lunastak.io>',
  replyTo: 'hello@lunastak.io',
  adminEmail: 'jonny@humventures.com.au',
} as const
