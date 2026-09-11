import { PostHog } from 'posthog-node'
import packageJson from '../../../package.json'

/**
 * Server-side PostHog — running alongside Statsig while we evaluate a switch (2026-09-11).
 *
 * Off unless NEXT_PUBLIC_POSTHOG_KEY is set (the project token is public by design, so the server
 * shares the client's). Every call is best-effort: analytics must never fail a request.
 */

let client: PostHog | null = null

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!client) {
    // Serverless: send each event immediately — the function may freeze straight after responding.
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}

export async function capturePostHogServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = getClient()
  if (!ph) return
  try {
    ph.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        app_version: packageJson.version,
        tier: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      },
    })
    await ph.flush()
  } catch (error) {
    console.error('[PostHog] Server capture failed:', error)
  }
}

/**
 * Fold a guest's PostHog person into the account they signed up as.
 *
 * Guests are real `User` rows, identified in PostHog by their row id, and the row is deleted on
 * signup. Two identified people can't be joined by `identify` or `alias`, so without this the
 * guest's whole pre-signup journey stays stranded on a person nobody will ever see again.
 * `$merge_dangerously` is irreversible — call it only once the data transfer has committed.
 */
export async function mergeGuestIntoUser(guestUserId: string, userId: string): Promise<void> {
  await capturePostHogServer(userId, '$merge_dangerously', { alias: guestUserId })
}
