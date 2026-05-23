/**
 * Renders a React Email template to HTML for sending via Resend.
 *
 * Critical: React Email URL-encodes the {{{RESEND_UNSUBSCRIBE_URL}}} merge tag.
 * We decode it back so Resend can substitute the per-recipient unsubscribe URL.
 *
 * Mirrors humventures.com.au/src/lib/render-email.ts but accepts any React element.
 */
import { render } from '@react-email/components'
import type { ReactElement } from 'react'

export async function renderEmail(template: ReactElement): Promise<string> {
  const html = await render(template)

  return html.replace(
    /%7B%7B%7BRESEND_UNSUBSCRIBE_URL%7D%7D%7D/g,
    '{{{RESEND_UNSUBSCRIBE_URL}}}'
  )
}
