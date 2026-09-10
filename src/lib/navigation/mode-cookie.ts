/**
 * The per-device mode preference, as a cookie.
 *
 * ⚠ WHY A COOKIE AND NOT `localStorage`. It replaces `localStorage['project-<id>-tab']`, and the
 * preference itself is legitimate — "which mode do I prefer on this project" is the same class of
 * thing as "is the summary panel collapsed", correctly per-device. What changed is the reader: the
 * landing decision moved to a server component so the back button works, and a server component
 * cannot read `localStorage`. A cookie is the same scope with a substrate the server can see.
 *
 * ⚠ NOT `httpOnly` — the toggle writes it from the client on every mode change.
 *
 * No migration from the old keys. A returning user lands on the stack once and their next toggle
 * sets the cookie; migrating would mean shipping a client shim to copy a value that rewrites itself
 * on first use.
 */

import type { ProjectMode } from './resolve-mode'

const PREFIX = 'lunastak_mode_'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Project-scoped, like the localStorage key it replaces — a preference per project, not per user. */
export function modeCookieName(projectId: string): string {
  return `${PREFIX}${projectId}`
}

/**
 * Client-side write. Called by the mode toggle.
 *
 * `SameSite=Lax` so the preference survives an ordinary inbound link (an email, the marketing site)
 * without being sent on cross-site subrequests.
 */
export function writeModeCookie(projectId: string, mode: ProjectMode): void {
  if (typeof document === 'undefined') return
  document.cookie = `${modeCookieName(projectId)}=${mode}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
}

/**
 * Parse a raw cookie value. Returns it untouched — `resolveProjectMode` owns which values are
 * ACCEPTABLE (it rejects `review` and anything legacy); this only reports what is stored.
 * Keeping the two separate means the junk-value rules are tested in exactly one place.
 */
export function readModeCookieValue(raw: string | undefined | null): string | null {
  if (!raw) return null
  return raw
}
