'use client'

import posthog from 'posthog-js'
import packageJson from '../../../package.json'

/**
 * Browser-side PostHog — running alongside Statsig while we evaluate a switch (2026-09-11).
 *
 * Off unless NEXT_PUBLIC_POSTHOG_KEY is set. Autocapture and pageviews come from the SDK; custom
 * events arrive through `logAndFlush`, so the catalogue in analytics-events.md applies unchanged.
 * Session replay is off, here in code — see the init below.
 */

type UserType = 'guest' | 'signed_up' | 'unknown'

let ready = false

export function initPostHog(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (ready || !key || typeof window === 'undefined') return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    // App Router navigations are client-side, so a pageview per history change, not per load.
    capture_pageview: 'history_change',
    // Anonymous visitors cost nothing until they become a guest or sign up.
    person_profiles: 'identified_only',
    // Replay is off by decision (2026-09-11), in code so no dashboard toggle can turn it on.
    disable_session_recording: true,
  })
  posthog.register({
    // The marketing site shares this PostHog project (and cookie), and registers `site: marketing`.
    site: 'app',
    app_version: packageJson.version,
    tier: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  })
  ready = true
}

/**
 * Point PostHog at the database user — guests included, since a guest is a real `User` row.
 *
 * A guest who signs up comes back with a different id, and PostHog refuses to identify an already
 * identified person as someone else. So the browser starts afresh as the new user, and the server
 * folds the guest's history in when it transfers their data (`mergeGuestIntoUser`).
 */
export function identifyPostHog(userId: string, userType: UserType, email?: string): void {
  if (!ready) return
  posthog.register({ userType })
  if (posthog.get_distinct_id() === userId) return

  if (posthog.get_property('$user_state') === 'identified') posthog.reset()
  posthog.identify(userId, {
    userType,
    // Guests' addresses are synthetic, and would only clutter the person list.
    ...(userType === 'signed_up' && email ? { email } : {}),
  })
}

export function capturePostHog(event: string, properties?: Record<string, unknown>): void {
  if (!ready) return
  posthog.capture(event, properties)
}

/** On sign-out, so the next person on this browser isn't recorded as the last one. */
export function resetPostHog(): void {
  if (!ready) return
  posthog.reset()
}
