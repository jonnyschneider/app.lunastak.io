/**
 * Ratchet: every API route goes through `@/lib/auth/guard`, or is on PUBLIC with a reason.
 *
 * Why this exists (2026-09-11): an inventory found 14 routes with no auth at all — read any
 * conversation by id, spend LLM on any project, an open LLM proxy — and ~17 hand-rolled copies of
 * "who is this request". `src/middleware.ts` does NO auth. Same enforcement shape as
 * claude-wrapper.test.ts: the rule is only real if a test fails when it's broken.
 *
 * Adding a route? Import the guard. Genuinely public? Add it to PUBLIC with the reason, and a
 * `mustContain` if its safety depends on an env guard or signature check being present.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const GUARD_IMPORT = /from ['"]@\/lib\/auth\/guard['"]/

const PUBLIC: Record<string, { reason: string; mustContain?: string }> = {
  'src/app/api/admin/eval/route.ts': { reason: 'local eval viewer, dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/admin/eval/[evalId]/route.ts': { reason: 'local eval viewer, dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/auth/[...nextauth]/route.ts': { reason: 'NextAuth itself' },
  'src/app/api/auth/verify-marketing/route.ts': { reason: 'dev-only', mustContain: 'NODE_ENV' },
  'src/app/api/guest/init/route.ts': { reason: 'mints the guest cookie — there is no requester yet' },
  'src/app/api/conversation/start/route.ts': {
    reason: 'mints a guest when there is no requester; identity comes from getRequester()',
    mustContain: 'getRequester',
  },
  'src/app/api/demo/strategy/route.ts': { reason: 'public demo content' },
  'src/app/api/dev-login/route.ts': { reason: 'dev-only', mustContain: 'NODE_ENV' },
  'src/app/api/dev/fixtures/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/dev/fixtures/[file]/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/dev/project-state/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/dev/snapshots/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/email/webhook/route.ts': { reason: 'Resend webhook, svix-signed', mustContain: 'svix' },
  'src/app/api/events/route.ts': { reason: 'anonymous client analytics, by design' },
  'src/app/api/feedback/route.ts': { reason: 'anonymous feedback form, by design' },
  'src/app/api/waitlist/route.ts': { reason: 'marketing waitlist signup, by design' },
  'src/app/api/test/seed-user/route.ts': { reason: 'e2e seeding', mustContain: 'ENABLE_TEST_ENDPOINTS' },
}

/**
 * ⚠ SHRINK ONLY. Routes not yet on the guard (2026-09-11). Each task in the auth-gap plan removes
 * its entries; the last one deletes this list and the test below that reads it.
 */
const KNOWN_UNGUARDED: string[] = [
  'src/app/api/auth/prepare-transfer/route.ts',
  'src/app/api/conversation/[id]/detail/route.ts',
  'src/app/api/paywall/prompt/route.ts',
  'src/app/api/project/[id]/share/route.ts',
  'src/app/api/projects/[id]/route.ts',
  'src/app/api/projects/route.ts',
  'src/app/api/strategies/[id]/route.ts',
  'src/app/api/strategies/route.ts',
  'src/app/api/transfer-session/route.ts',
  'src/app/api/user/account/route.ts',
  'src/app/api/user/upgrade/route.ts',
]

/**
 * Tracked AND untracked (not ignored) route files, so a new route fails before it's committed.
 * The pathspec's `*` matches across `/` and the literal `[id]` segments are in the paths, not the
 * pattern — but a glob that silently matched nothing would make every test below vacuously pass,
 * hence the count check.
 */
function routeFiles(): string[] {
  return execFileSync(
    'git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src/app/api/**/route.ts'],
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean)
}

const guarded = (f: string) => GUARD_IMPORT.test(readFileSync(f, 'utf8'))

describe('API route auth', () => {
  it('discovers the API routes (a broken glob must not pass vacuously)', () => {
    const files = routeFiles()
    expect(files.length).toBeGreaterThan(50)
    expect(files).toContain('src/app/api/project/[id]/content/route.ts')
  })

  it('every API route imports the guard or is explicitly public', () => {
    const offenders = routeFiles().filter(f => !guarded(f) && !(f in PUBLIC) && !KNOWN_UNGUARDED.includes(f))
    expect(offenders, 'import @/lib/auth/guard, or add to PUBLIC with a reason').toEqual([])
  })

  it('public routes still carry the guard their safety depends on', () => {
    const missing = Object.entries(PUBLIC)
      .filter(([f, { mustContain }]) => mustContain && existsSync(f) && !readFileSync(f, 'utf8').includes(mustContain))
      .map(([f, { mustContain }]) => `${f} (expected "${mustContain}")`)
    expect(missing).toEqual([])
  })

  it('the lists name only files that exist', () => {
    const stale = [...Object.keys(PUBLIC), ...KNOWN_UNGUARDED].filter(f => !existsSync(f))
    expect(stale, 'remove entries for deleted routes').toEqual([])
  })

  it('KNOWN_UNGUARDED only shrinks — a guarded route must leave the list', () => {
    expect(KNOWN_UNGUARDED.filter(guarded), 'now guarded — delete from KNOWN_UNGUARDED').toEqual([])
  })

  /** The fingerprint of a hand-rolled "who is this request" — 17 of them existed on 2026-09-11. */
  const HAND_ROLLED = [/const\s+GUEST_COOKIE_NAME\s*=/, /async\s+function\s+get\w*UserId\s*\(/]

  it('no route re-implements identity — import getRequester / GUEST_COOKIE_NAME instead', () => {
    // Routes still on KNOWN_UNGUARDED are exempt while they wait their turn; the exemption goes
    // when that list does (auth-gap plan Task 11, Step 3).
    const offenders = routeFiles().filter(
      f => !KNOWN_UNGUARDED.includes(f) && HAND_ROLLED.some(re => re.test(readFileSync(f, 'utf8'))),
    )
    expect(offenders).toEqual([])
  })

  /**
   * Importing the guard isn't the same as using the RIGHT guard. The likeliest future mistake is
   * `requireUser()` followed by a `findUnique({ where: { id } })`: authenticated, but not authorised.
   * A route whose path names a resource by id has to call that resource's guard.
   * Ids that arrive in the body (extract, continue) can't be seen here, so conventions-rubric C29
   * covers those as JUDGMENT.
   */
  const SEGMENT_GUARD: [RegExp, string][] = [
    [/\/api\/project\/\[id\]\//, 'requireProjectAccess'],
    [/\/api\/conversation\/\[id\]\//, 'requireConversationAccess'],
    [/\/api\/trace\/\[traceId\]\//, 'requireTraceAccess'],
    [/\/api\/documents\/\[id\]\//, 'requireDocumentAccess'],
    [/\/api\/extraction-status\/\[conversationId\]\//, 'requireConversationAccess'],
  ]

  it('a route addressed by a resource id calls that resource’s guard', () => {
    const wrong = routeFiles().filter(guarded).flatMap(f => {
      const src = readFileSync(f, 'utf8')
      return SEGMENT_GUARD.filter(([re, fn]) => re.test(f) && !src.includes(`${fn}(`)).map(([, fn]) => `${f} → ${fn}`)
    })
    expect(wrong).toEqual([])
  })
})
