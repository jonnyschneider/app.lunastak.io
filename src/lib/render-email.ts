/**
 * Email rendering utilities
 *
 * NOTE: This is a duplicate implementation from the marketing site
 * (lunastak.io/lib/render-email.ts).
 * If updating this file, consider whether the marketing site also needs updating.
 */
import { render } from '@react-email/components'
import { SubscribeConfirmEmail } from '@/emails/transactional/subscribe-confirm'

export async function renderSubscribeConfirmEmail(confirmationLink: string): Promise<string> {
  return await render(SubscribeConfirmEmail({ confirmationLink }))
}
