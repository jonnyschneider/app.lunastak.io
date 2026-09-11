/**
 * Anonymous demo deep links must survive the landing redirect.
 *
 * ⚠ THIS IS A REGRESSION TEST FOR A BUG THIS BRANCH INTRODUCED. The landing decision moved to a
 * server component, and its first version did `if (!userId) redirect('/auth/signin')`. That is
 * wrong for exactly the visitor a `/project/<demoId>` link from the marketing site is for: no
 * session, no guest cookie, so `getUserId()` returns null.
 *
 * The API mints a guest inline for that case (`api/project/[id]/route.ts`, GET) — but the redirect
 * runs BEFORE the client mounts, so the fallback never got to run. It also does not reproduce from
 * inside the app, because in-app demo links carry `?mode=stack` and never reach this branch. Cold,
 * clean browser, from marketing, only.
 *
 * A source test because the shape is what matters and the alternative is standing up a server
 * component with Prisma, next/headers and next-auth to observe one absent call.
 */
import * as fs from 'fs'
import * as path from 'path'

const ROUTE = fs.readFileSync(path.join(__dirname, '../../../app/project/[id]/page.tsx'), 'utf-8')

describe('the landing redirect', () => {
  it('does not bounce an anonymous visitor to sign-in', () => {
    expect(ROUTE).not.toMatch(/if \(!userId\)\s*redirect/)
  })

  it('scopes the project read to the caller or a demo, never a bare id lookup', () => {
    /*
     * An unscoped `findUnique({ where: { id } })` would let any caller infer another user's project
     * state from where the redirect lands — a project with fragments and no strategy sends you
     * somewhere different from an empty one.
     */
    expect(ROUTE).not.toMatch(/prisma\.project\.findUnique/)
    expect(ROUTE).toMatch(/OR: \[\{ userId: userId \?\? '' \}, \{ isDemo: true \}\]/)
    expect(ROUTE).toContain("status: 'active'")
  })

  it('treats an anonymous visitor as having no dismissals rather than failing', () => {
    expect(ROUTE).toMatch(/userId: userId \?\? ''[\s\S]{0,120}GROUND_TRUTH_REVIEW_ITEM_TYPE/)
  })
})
