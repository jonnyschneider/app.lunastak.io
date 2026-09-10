/**
 * The "which project was I last in" cookie.
 *
 * `/` is a redirector, and it used to always pick the OLDEST project. Closing a demo pushes `/`, so
 * leaving an example dumped the user into a different project than the one they were working in.
 *
 * The two rules that matter and are easy to break later:
 *   1. The value is a HINT. The reader hands it to a user-scoped query, so a stale or foreign id
 *      must degrade to the old oldest-project behaviour rather than 404 or leak.
 *   2. Demos never write it — enforced at the call site in `ProjectClient`, since this module has
 *      no way to know. Noted here so a future writer does not add one carelessly.
 */
import {
  LAST_PROJECT_COOKIE_NAME,
  readLastProjectCookie,
  writeLastProjectCookie,
} from '../last-project-cookie'

function currentCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${LAST_PROJECT_COOKIE_NAME}=`))
    ?.slice(LAST_PROJECT_COOKIE_NAME.length + 1)
}

beforeEach(() => {
  document.cookie = `${LAST_PROJECT_COOKIE_NAME}=; path=/; max-age=0`
})

describe('writeLastProjectCookie', () => {
  it('stores the id where the server can read it back', () => {
    writeLastProjectCookie('clx123abc')
    expect(readLastProjectCookie(currentCookie())).toBe('clx123abc')
  })

  it('keeps only the most recent project — it is one value, not a history', () => {
    writeLastProjectCookie('first')
    writeLastProjectCookie('second')
    expect(readLastProjectCookie(currentCookie())).toBe('second')
    expect(document.cookie.split('; ').filter(c => c.startsWith(LAST_PROJECT_COOKIE_NAME)))
      .toHaveLength(1)
  })

  it('refuses to write an id that is not id-shaped', () => {
    writeLastProjectCookie('not a cuid; path=/; evil=1')
    expect(currentCookie()).toBeUndefined()
  })
})

describe('readLastProjectCookie', () => {
  it('returns null when nothing is remembered', () => {
    expect(readLastProjectCookie(undefined)).toBeNull()
    expect(readLastProjectCookie(null)).toBeNull()
    expect(readLastProjectCookie('')).toBeNull()
  })

  it('returns null for junk rather than passing it to a query', () => {
    expect(readLastProjectCookie('{"p1":"stack"}')).toBeNull()
    expect(readLastProjectCookie('%')).toBeNull()
    expect(readLastProjectCookie('x'.repeat(200))).toBeNull()
  })

  it('accepts a plausible id — the database decides whether it is really theirs', () => {
    expect(readLastProjectCookie('clx123abc')).toBe('clx123abc')
    expect(readLastProjectCookie(encodeURIComponent('clx123abc'))).toBe('clx123abc')
  })
})
