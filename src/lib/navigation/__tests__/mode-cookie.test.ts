/**
 * The mode preference cookie.
 *
 * It is a cookie rather than `localStorage` because the landing decision moved to a server component
 * (so the back button works), and a server component cannot read `localStorage`.
 *
 * ⚠ AND IT IS ONE COOKIE HOLDING A BOUNDED MAP, not one cookie per project. The naive port was
 * `lunastak_mode_<projectId>`, a year each, never pruned — so the header grew by ~48 bytes for every
 * project a user ever opened, deleted ones included, and was sent on every request to the origin.
 * That fails as 431 Request Header Fields Too Large somewhere past a hundred projects, which breaks
 * the entire app for that user and is unrecoverable without clearing cookies by hand.
 */
import { MODE_COOKIE_NAME, writeModeCookie, readModeCookieValue } from '../mode-cookie'

function currentCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${MODE_COOKIE_NAME}=`))
    ?.slice(MODE_COOKIE_NAME.length + 1)
}

beforeEach(() => {
  document.cookie = `${MODE_COOKIE_NAME}=; path=/; max-age=0`
})

describe('writeModeCookie', () => {
  it('stores the mode where the server can read it back', () => {
    writeModeCookie('p1', 'knowledge')
    expect(readModeCookieValue(currentCookie(), 'p1')).toBe('knowledge')
  })

  it('remembers several projects independently', () => {
    writeModeCookie('p1', 'knowledge')
    writeModeCookie('p2', 'stack')
    expect(readModeCookieValue(currentCookie(), 'p1')).toBe('knowledge')
    expect(readModeCookieValue(currentCookie(), 'p2')).toBe('stack')
  })

  it('overwrites rather than accumulating for the same project', () => {
    writeModeCookie('p1', 'knowledge')
    writeModeCookie('p1', 'stack')
    expect(readModeCookieValue(currentCookie(), 'p1')).toBe('stack')
  })

  it('stays ONE cookie however many projects are touched', () => {
    for (let i = 0; i < 30; i++) writeModeCookie(`p${i}`, 'knowledge')
    const all = document.cookie.split('; ').filter((c) => c.startsWith('lunastak_mode'))
    expect(all).toHaveLength(1)
  })

  it('caps what it remembers, dropping the least recently set', () => {
    // The bound is the whole point: without it the header grows forever and eventually 431s.
    for (let i = 0; i < 30; i++) writeModeCookie(`p${i}`, 'knowledge')
    expect(readModeCookieValue(currentCookie(), 'p29')).toBe('knowledge')
    expect(readModeCookieValue(currentCookie(), 'p0')).toBeNull()
    expect(currentCookie()!.length).toBeLessThan(700)
  })

  it('moves a re-touched project to the most-recent end rather than letting it age out', () => {
    writeModeCookie('keep-me', 'stack')
    for (let i = 0; i < 9; i++) writeModeCookie(`filler${i}`, 'knowledge')
    writeModeCookie('keep-me', 'knowledge')
    for (let i = 0; i < 5; i++) writeModeCookie(`later${i}`, 'stack')
    expect(readModeCookieValue(currentCookie(), 'keep-me')).toBe('knowledge')
  })
})

describe('readModeCookieValue', () => {
  it('reports absence as null', () => {
    expect(readModeCookieValue(undefined, 'p1')).toBeNull()
    expect(readModeCookieValue('', 'p1')).toBeNull()
    expect(readModeCookieValue(encodeURIComponent('{}'), 'p1')).toBeNull()
  })

  it('survives a malformed cookie instead of throwing', () => {
    // An unreadable preference is not an error: the landing table has a perfectly good default.
    expect(readModeCookieValue('not-json', 'p1')).toBeNull()
    expect(readModeCookieValue(encodeURIComponent('[1,2,3]'), 'p1')).toBeNull()
    expect(readModeCookieValue(encodeURIComponent('"a string"'), 'p1')).toBeNull()
  })

  it('reports what is stored WITHOUT judging it — resolveProjectMode owns that', () => {
    const raw = encodeURIComponent(JSON.stringify({ p1: 'direction', p2: 'review' }))
    expect(readModeCookieValue(raw, 'p1')).toBe('direction')
    expect(readModeCookieValue(raw, 'p2')).toBe('review')
  })
})
