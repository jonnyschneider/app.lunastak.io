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
  // NOT dev-only (the 2026-09-11 inventory said so, and its NODE_ENV "guard" was a secure-cookie
  // flag): this is the production sign-in for marketing-site magic links. The signed JWT is the gate.
  'src/app/api/auth/verify-marketing/route.ts': {
    reason: 'marketing-site magic-link sign-in; the signed JWT is the credential',
    mustContain: 'verifyMagicLinkToken',
  },
  'src/app/api/guest/init/route.ts': { reason: 'mints the guest cookie — there is no requester yet' },
  'src/app/api/demo/strategy/route.ts': { reason: 'public demo content' },
  'src/app/api/dev-login/route.ts': { reason: 'dev-only', mustContain: 'NODE_ENV' },
  'src/app/api/dev/fixtures/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/dev/fixtures/[file]/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/dev/project-state/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/dev/snapshots/route.ts': { reason: 'dev-only', mustContain: 'VERCEL_ENV' },
  'src/app/api/email/webhook/route.ts': { reason: 'Resend webhook, svix-signed', mustContain: 'svix' },
  'src/app/api/events/route.ts': { reason: 'anonymous client analytics, by design' },
  'src/app/api/waitlist/route.ts': { reason: 'marketing waitlist signup, by design' },
  'src/app/api/test/seed-user/route.ts': { reason: 'e2e seeding', mustContain: 'ENABLE_TEST_ENDPOINTS' },
}

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

const GUARD_FNS = ['requireUser', 'requireProjectAccess', 'requireConversationAccess', 'requireTraceAccess', 'requireDocumentAccess']
const HTTP_METHOD = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/

/** Comments out, so a guard named in a doc comment doesn't count. `(^|\s)//` spares `https://`. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')

/**
 * A route file's top-level functions: `[export] [async] function name` or `[export] const name =`,
 * each at column 0 (they all are) and running until the next. Imperfect as a parser, fine as a
 * ratchet: anything it mis-splits fails loudly (a handler reported unguarded), never silently.
 */
function declarations(src: string): { name: string; exported: boolean; body: string }[] {
  const code = stripComments(src)
  const starts = Array.from(code.matchAll(/^(export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/gm))
  return starts.map((m, i) => ({
    name: m[2] ?? m[3],
    exported: Boolean(m[1]),
    body: code.slice(m.index ?? 0, starts[i + 1]?.index ?? code.length),
  }))
}

const calls = (body: string, fn: string) => new RegExp(`\\b${fn}\\(`).test(body)

const handlerNames = (src: string) => declarations(src).filter(d => d.exported && HTTP_METHOD.test(d.name)).map(d => d.name)

/**
 * The exported handlers in `src` that never reach one of `fns`. A handler reaches it by calling it,
 * or by calling a same-file helper that does (one level — `deep-dive/[id]`'s
 * `canAccessDeepDiveProject`, `project/[id]/share`'s `requireShareableProject`).
 */
function unguardedHandlers(src: string, fns: string[]): string[] {
  const decls = declarations(src)
  const reaches = (body: string) => fns.some(fn => calls(body, fn))
  const guardingHelpers = decls.filter(d => !HTTP_METHOD.test(d.name) && reaches(d.body)).map(d => d.name)
  return decls
    .filter(d => d.exported && HTTP_METHOD.test(d.name))
    .filter(h => !reaches(h.body) && !guardingHelpers.some(helper => calls(h.body, helper)))
    .map(h => h.name)
}

describe('API route auth', () => {
  it('discovers the API routes (a broken glob must not pass vacuously)', () => {
    const files = routeFiles()
    expect(files.length).toBeGreaterThan(50)
    expect(files).toContain('src/app/api/project/[id]/content/route.ts')
  })

  it('every API route imports the guard or is explicitly public', () => {
    const offenders = routeFiles().filter(f => !guarded(f) && !(f in PUBLIC))
    expect(offenders, 'import @/lib/auth/guard, or add to PUBLIC with a reason').toEqual([])
  })

  /**
   * Importing the guard is per file; a forgotten check is per handler. Adding an unguarded DELETE
   * next to a guarded GET must fail here, not pass because the file already imports the guard.
   */
  it('every handler in a non-public route reaches a guard', () => {
    const offenders = routeFiles().filter(f => !(f in PUBLIC))
      .flatMap(f => unguardedHandlers(readFileSync(f, 'utf8'), GUARD_FNS).map(h => `${f} ${h}`))
    expect(offenders, 'call a guard in the handler, or in a same-file helper it calls').toEqual([])
  })

  it('every non-public route has a handler the check can see (an unseen export form would pass vacuously)', () => {
    const unseen = routeFiles().filter(f => !(f in PUBLIC) && handlerNames(readFileSync(f, 'utf8')).length === 0)
    expect(unseen, 'export handlers as `export async function GET` or `export const GET =`').toEqual([])
  })

  it('public routes still carry the guard their safety depends on', () => {
    const missing = Object.entries(PUBLIC)
      .filter(([f, { mustContain }]) => mustContain && existsSync(f) && !readFileSync(f, 'utf8').includes(mustContain))
      .map(([f, { mustContain }]) => `${f} (expected "${mustContain}")`)
    expect(missing).toEqual([])
  })

  it('PUBLIC names only files that exist', () => {
    const stale = Object.keys(PUBLIC).filter(f => !existsSync(f))
    expect(stale, 'remove entries for deleted routes').toEqual([])
  })

  /** The fingerprint of a hand-rolled "who is this request" — 17 of them existed on 2026-09-11. */
  const HAND_ROLLED = [/const\s+GUEST_COOKIE_NAME\s*=/, /async\s+function\s+get\w*UserId\s*\(/]

  it('no route re-implements identity — import getRequester / GUEST_COOKIE_NAME instead', () => {
    const offenders = routeFiles().filter(f => HAND_ROLLED.some(re => re.test(readFileSync(f, 'utf8'))))
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
    [/\/api\/projects\/\[id\]\//, 'requireProjectAccess'],
    [/\/api\/strategies\/\[id\]\//, 'requireTraceAccess'],
  ]

  it('every handler in an addressed-by-id route reaches that resource’s guard', () => {
    const wrong = routeFiles().filter(f => !(f in PUBLIC)).flatMap(f => {
      const src = readFileSync(f, 'utf8')
      return SEGMENT_GUARD.filter(([re]) => re.test(f))
        .flatMap(([, fn]) => unguardedHandlers(src, [fn]).map(h => `${f} ${h} → ${fn}`))
    })
    expect(wrong).toEqual([])
  })
})

describe('unguardedHandlers — the per-handler check the ratchet runs', () => {
  const guardedGet = `export async function GET() {\n  const auth = await requireProjectAccess(id)\n  return auth\n}\n`

  it('flags an unguarded handler even when another handler in the file is guarded', () => {
    const src = guardedGet + `export async function DELETE() {\n  await prisma.project.delete({ where: { id } })\n}\n`
    expect(unguardedHandlers(src, GUARD_FNS)).toEqual(['DELETE'])
  })

  it('accepts one level of indirection through a same-file helper', () => {
    const src = `async function canAccess(id) {\n  return requireProjectAccess(id)\n}\n` +
      `export async function PATCH() {\n  if (!(await canAccess(id))) return nope\n}\n`
    expect(unguardedHandlers(src, GUARD_FNS)).toEqual([])
  })

  it('does not count a guard that is only mentioned in a comment', () => {
    const src = `/**\n * Calls requireUser( before anything.\n */\nexport async function POST() {\n  // requireUser() goes here\n  return ok\n}\n`
    expect(unguardedHandlers(src, GUARD_FNS)).toEqual(['POST'])
  })

  it('does not count a guarding helper the handler never calls', () => {
    const src = `function unused() {\n  return requireUser()\n}\n` + `export const GET = async () => {\n  return list()\n}\n`
    expect(unguardedHandlers(src, GUARD_FNS)).toEqual(['GET'])
  })

  it('checks for the specific guard when asked (the SEGMENT_GUARD rule)', () => {
    const src = `export async function GET() {\n  const r = await requireUser()\n}\n`
    expect(unguardedHandlers(src, ['requireProjectAccess'])).toEqual(['GET'])
    expect(unguardedHandlers(src, ['requireUser'])).toEqual([])
  })
})
