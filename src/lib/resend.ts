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
// RESEND_FROM_EMAIL can be either "email@domain.com" or "Name <email@domain.com>"
const fromEmail = process.env.RESEND_FROM_EMAIL || 'luna@lunastak.io'
const formattedFrom = fromEmail.includes('<') ? fromEmail : `Lunastak <${fromEmail}>`

export const EMAIL_CONFIG = {
  from: formattedFrom,
  replyTo: 'luna@lunastak.io',
  adminEmail: process.env.ADMIN_EMAIL || 'jonny@humventures.com.au',
} as const
