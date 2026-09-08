/**
 * Ratchet: an App Router route file exports handlers and config — nothing else.
 *
 * Next.js rejects any other export from a `route.ts` at BUILD time:
 *   Type error: "parseEmergentThemes" is not a valid Route export field.
 *
 * `tsc --noEmit` cannot see this — it is a Next-specific constraint checked only by
 * `next build`, which `npm run verify` does not run. So a route that exports a helper
 * passes type-check, tests and smoke, and fails on the deploy. That is exactly what
 * happened on feat/ground-truth-check-backend: `parseEmergentThemes` was exported from
 * src/app/api/extract/route.ts purely so a test could import it, the branch was
 * build-broken from that commit onward, and nothing caught it until the preview build.
 *
 * The pressure that causes this is always the same — a test wants at a pure function
 * buried in a route. The answer is to move the function to `src/lib/`, not to widen the
 * route's exports. That is also what C9 ("routes are thin HTTP wrappers") already asks for.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const HANDLERS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
const CONFIG = [
  'dynamic', 'dynamicParams', 'revalidate', 'fetchCache',
  'runtime', 'preferredRegion', 'maxDuration', 'generateStaticParams',
]

const ALLOWED = new Set([...HANDLERS, ...CONFIG])

function routeFiles(): string[] {
  return execFileSync('git', ['ls-files', 'src/app/**/route.ts'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

/** Top-level `export` declarations, by name. Deliberately simple — routes are small. */
function exportedNames(src: string): string[] {
  const names: string[] = []
  const re = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) names.push(m[1])
  return names
}

describe('App Router route files', () => {
  const files = routeFiles()

  it('finds route files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s exports only handlers and config', (file) => {
    const illegal = exportedNames(readFileSync(file, 'utf8')).filter((n) => !ALLOWED.has(n))
    expect(
      illegal,
      `${file} exports ${illegal.join(', ')} — not a valid Route export. ` +
        `next build will fail. Move it to src/lib/ and import it here.`,
    ).toEqual([])
  })

  it('rejects a helper export', () => {
    expect(exportedNames('export function parseThings(x: string) {}')).toEqual(['parseThings'])
  })

  it('accepts handlers and config', () => {
    const src = 'export const maxDuration = 300;\nexport async function POST(req: Request) {}'
    expect(exportedNames(src).filter((n) => !ALLOWED.has(n))).toEqual([])
  })
})
