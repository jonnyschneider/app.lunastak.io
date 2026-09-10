/**
 * The per-device mode preference: ONE cookie holding a bounded map.
 *
 * ⚠ WHY A COOKIE AND NOT `localStorage`. It replaces `localStorage['project-<id>-tab']`, and the
 * preference itself is legitimate — "which mode do I prefer on this project" is the same class of
 * thing as "is the summary panel collapsed", correctly per-device. What changed is the reader: the
 * landing decision moved to a server component so the back button works, and a server component
 * cannot read `localStorage`.
 *
 * ⚠ WHY ONE COOKIE AND NOT ONE PER PROJECT. The naive port was `lunastak_mode_<projectId>`, a year
 * each, never pruned — so a user's cookie header grew by ~48 bytes per project they ever opened,
 * including deleted ones, and was sent on EVERY request to the origin: page loads, API calls, RSC
 * payloads. That does not degrade gradually. Somewhere past a hundred projects it crosses the
 * server's header limit and returns 431 for everything, which breaks the whole app for that user
 * rather than just their preference, and is unrecoverable without clearing cookies by hand.
 *
 * Dev data at the time of writing: median 1 project per user, p90 of 2, max 17. So this was a
 * latent trap rather than a live outage — which is exactly the kind that ships.
 *
 * A map trimmed to the most-recently-set `MAX_REMEMBERED` keeps the per-project semantics the design
 * called for, at a bounded ~500 bytes. Least-recently-set entries fall off the front, which is also
 * how deleted projects get collected: nothing has to know they are gone.
 *
 * ⚠ NOT `httpOnly` — the toggle writes it from the client.
 *
 * No migration from the old keys, and none from the per-project cookies either: a returning user
 * lands on the stack once and their next toggle rewrites this. Migrating would mean shipping a shim
 * to copy a value that overwrites itself on first use.
 */

import type { ProjectMode } from './resolve-mode'

export const MODE_COOKIE_NAME = 'lunastak_modes'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Enough for every real user we can see, and small enough that the header stays trivial. Insertion
 * order is the recency order: JSON objects preserve string-key insertion order, and a write deletes
 * before re-adding so a touched project moves to the end.
 */
const MAX_REMEMBERED = 10

type ModeMap = Record<string, string>

function parse(raw: string | undefined | null): ModeMap {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as ModeMap
  } catch {
    // A malformed cookie is a preference we cannot read, not an error worth surfacing: the caller
    // falls through to the landing table, which has a perfectly good default.
    return {}
  }
}

/** Server-side read. Returns the raw stored value — `resolveProjectMode` owns which are acceptable. */
export function readModeCookieValue(raw: string | undefined | null, projectId: string): string | null {
  const value = parse(raw)[projectId]
  return typeof value === 'string' && value ? value : null
}

/** Client-side write, called by the mode toggle. */
export function writeModeCookie(projectId: string, mode: ProjectMode): void {
  if (typeof document === 'undefined') return

  const current = parse(
    document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${MODE_COOKIE_NAME}=`))
      ?.slice(MODE_COOKIE_NAME.length + 1)
  )

  // Delete before re-adding so this project becomes the most recent, then trim from the front.
  delete current[projectId]
  const trimmed = Object.entries({ ...current, [projectId]: mode }).slice(-MAX_REMEMBERED)

  const value = encodeURIComponent(JSON.stringify(Object.fromEntries(trimmed)))
  // Matches every other cookie write in the codebase (`secure: NODE_ENV === 'production'`), rather
  // than sniffing the protocol — consistency is worth more here than the marginal correctness of
  // handling an https dev server nobody runs.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  document.cookie =
    `${MODE_COOKIE_NAME}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
}
