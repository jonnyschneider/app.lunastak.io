/**
 * "Which project was I last in?" — one cookie, one id.
 *
 * `/` is not a homepage: it is a redirector that has always sent you to your OLDEST project
 * (`orderBy: { createdAt: 'asc' }`). With one project that is invisible. With several it is a reset,
 * and the place it bites is closing a demo — the demo banner's X pushes `/`, so leaving an example
 * dropped you into a different project than the one you were working in (Jonny, 2026-09-10:
 * *"it's disorienting"*).
 *
 * ⚠ DEMOS DO NOT WRITE THIS. A demo is somewhere you visit, not somewhere you work, and it is not
 * even yours — `isDemo` projects are readable by everyone. Recording one would make the X send you
 * back to the demo you just closed, which is worse than the bug it is fixing.
 *
 * ⚠ THE STORED ID IS NEVER TRUSTED. It is a hint, not an authorisation: the reader looks the id up
 * scoped to the current user and falls back to the oldest project when that finds nothing. So a
 * stale id (project deleted), a foreign id (cookie copied between accounts), or junk all degrade to
 * exactly today's behaviour rather than leaking or 404ing.
 *
 * ⚠ NOT `httpOnly` — the project page writes it from the client, for the same reason
 * `lunastak_modes` does: a server component cannot set a cookie during render, and the alternatives
 * (middleware, a write-only route hit on every project view) buy nothing here.
 *
 * Kept separate from `lunastak_modes` rather than folded into that map: this is one value about the
 * user, that one is a bounded per-project map, and they are read in different places (`/` vs
 * `/project/[id]`). Sharing a cookie would couple a trim policy to a fact that must not be trimmed.
 */

export const LAST_PROJECT_COOKIE_NAME = 'lunastak_last_project'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Ids are cuids. This is a sanity gate, not a validation: the reader's database lookup is what
 * actually decides. It exists so obvious junk never reaches a query.
 */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/

/** Server-side read. Returns a plausible id or null — the caller must still scope the lookup. */
export function readLastProjectCookie(raw: string | undefined | null): string | null {
  if (!raw) return null
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    return null
  }
  return ID_SHAPE.test(value) ? value : null
}

/** Client-side write, called when a project you own is opened. */
export function writeLastProjectCookie(projectId: string): void {
  if (typeof document === 'undefined') return
  if (!ID_SHAPE.test(projectId)) return

  // Matches every other cookie write in the codebase (`secure: NODE_ENV === 'production'`).
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  document.cookie =
    `${LAST_PROJECT_COOKIE_NAME}=${encodeURIComponent(projectId)}` +
    `; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
}
