/**
 * The mode preference cookie.
 *
 * It exists as a cookie rather than `localStorage` for one reason: the landing decision moved to a
 * server component (so the back button works), and a server component cannot read `localStorage`.
 * Same per-device scope, readable substrate.
 */
import { modeCookieName, writeModeCookie, readModeCookieValue } from '../mode-cookie'

describe('modeCookieName', () => {
  it('is project-scoped, like the localStorage key it replaces', () => {
    expect(modeCookieName('abc')).toBe('lunastak_mode_abc')
    expect(modeCookieName('abc')).not.toBe(modeCookieName('def'))
  })
})

describe('writeModeCookie', () => {
  beforeEach(() => {
    // jsdom shares document.cookie across tests; clear what we set.
    document.cookie = `${modeCookieName('p1')}=; path=/; max-age=0`
  })

  it('stores the mode where the server can read it back', () => {
    writeModeCookie('p1', 'knowledge')
    expect(document.cookie).toContain(`${modeCookieName('p1')}=knowledge`)
  })

  it('overwrites rather than accumulating — one preference per project', () => {
    writeModeCookie('p1', 'knowledge')
    writeModeCookie('p1', 'stack')
    const matches = document.cookie.split(';').filter((c) => c.trim().startsWith(modeCookieName('p1')))
    expect(matches).toHaveLength(1)
    expect(matches[0]).toContain('stack')
  })
})

describe('readModeCookieValue', () => {
  it('reports absence as null', () => {
    expect(readModeCookieValue(undefined)).toBeNull()
    expect(readModeCookieValue(null)).toBeNull()
    expect(readModeCookieValue('')).toBeNull()
  })

  it('reports what is stored WITHOUT judging it — resolveProjectMode owns that', () => {
    /*
     * Deliberate split. If this filtered junk too, "which values are acceptable" would be enforced
     * in two places and could drift. resolveProjectMode rejects 'review' and legacy values, and its
     * tests are the single record of that rule.
     */
    expect(readModeCookieValue('direction')).toBe('direction')
    expect(readModeCookieValue('review')).toBe('review')
  })
})
