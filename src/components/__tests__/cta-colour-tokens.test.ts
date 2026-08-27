/**
 * CTAs take their colour from the design tokens, never a hardcoded Tailwind palette class.
 *
 * The "Generate Strategy" button carried `bg-green-600` from v1.4.2. It was the only green
 * in the app, it was flagged as a FAIL in the 2026-04-02 preview UAT — and it was still
 * there on 2026-08-27, because that UAT recorded the fix as "investigating" and nothing
 * ever failed on it. Five months of a green primary CTA in a mulberry product.
 *
 * A shrinking ALLOW set, not a blanket ban: status colours (a success tick, a live dot)
 * are legitimately green. Add to ALLOW deliberately, with a reason.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Files permitted a hardcoded palette colour, each for a stated reason. */
const ALLOW = new Set<string>([
  // The "Create Account" CTA sits INSIDE a deliberate amber warning Alert
  // (border-amber-200 / bg-amber-50 / text-amber-800), so its orange reads as
  // part of that warning surface rather than as a stray brand colour. Kept as
  // found on 2026-08-27 rather than restyled — a conversion CTA is not a
  // drive-by change. Revisit if the banner leaves the amber treatment.
  'src/components/GuestSaveBanner.tsx',
])

/** Palette families that must come from tokens on an interactive CTA. */
const HARDCODED = /\bbg-(green|emerald|lime|teal|cyan|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow)-\d{2,3}\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      walk(full, out)
    } else if (/\.tsx$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('CTA colours come from design tokens', () => {
  it('no <Button> carries a hardcoded palette background', () => {
    const root = join(process.cwd(), 'src', 'components')
    const offenders: string[] = []

    for (const file of walk(root)) {
      const rel = file.slice(file.indexOf('src/'))
      if (ALLOW.has(rel)) continue
      const src = readFileSync(file, 'utf8')

      // Only care about palette classes sitting on a <Button …className="…">.
      const buttons = src.match(/<Button[\s\S]{0,400}?>/g) ?? []
      for (const b of buttons) {
        const hit = b.match(HARDCODED)
        if (hit) offenders.push(`${rel}: ${hit[0]}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
