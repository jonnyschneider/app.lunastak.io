/**
 * Builds the ground-truth-check fixture from REAL spike output.
 *
 * Every claim, excerpt and type below came out of the 2026-09-04 spikes against real
 * documents and real prod conversations (§14, §15) — nothing here is invented. Document
 * excerpts carry verification: 'verified' because they were substring-matched against the
 * source while it was in hand. Bundle excerpts carry 'unverifiable' because Lunastak never
 * sees the conversation a bundle was produced from — the honest per-row state, not a
 * uniform promise.
 *
 * Run: node src/app/prototype/ground-truth-check/build-fixture.mjs
 */
import fs from 'fs'
import path from 'path'

const SP = '/private/tmp/claude-501/-Users-Jonny-Dev-humventures-lunastak-app-lunastak-io/4bf06b1b-54cf-4fad-ba3e-4d53a4edbaa1/scratchpad'
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixture.json')

const read = f => JSON.parse(fs.readFileSync(path.join(SP, f), 'utf8'))

const DOCS = [
  ['spike-voice-memo-transcript_md.json', 'Voice memo transcript', 'document'],
  ['spike-2026-01-03-jobs-to-be-done_md.json', 'Jobs to be done.md', 'document'],
  ['spike-Humble_Positioning_md.json', 'Humble Positioning.md', 'document'],
]

const items = []
let n = 0

for (const [file, source, kind] of DOCS) {
  if (!fs.existsSync(path.join(SP, file))) continue
  const runs = read(file).C_typed ?? []
  for (const theme of runs[0] ?? []) {
    const excerpt = (theme.spans ?? [])[0]
    if (!excerpt) continue
    items.push({
      id: `f${++n}`,
      claim: theme.name,
      reading: theme.content,
      type: theme.type === 'interpretation' ? 'interpretation' : 'verbatim',
      excerpt,
      verification: 'verified',
      source, kind,
    })
  }
}

// Bundle rows — the volume case, and the unverifiable one.
if (fs.existsSync(path.join(SP, 'bundle-excerpt-spike.json'))) {
  const rows = read('bundle-excerpt-spike.json').filter(r => r.arm === 'C_typed' && (r.theme.evidence ?? []).length)
  const seen = new Set()
  for (const r of rows) {
    const claim = r.theme.theme
    if (!claim || seen.has(claim) || seen.size >= 25) continue
    seen.add(claim)
    items.push({
      id: `f${++n}`,
      claim,
      reading: '',                       // bundles carry no separate reading — the claim IS the theme
      type: r.theme.type === 'interpretation' ? 'interpretation' : 'verbatim',
      excerpt: r.theme.evidence[0],
      verification: 'unverifiable',      // the source conversation never reaches Lunastak
      source: 'Context bundle', kind: 'bundle',
      area: r.theme.area,
    })
  }
}

/**
 * Tranche = support strength, computed. Never shown to a producer, never in a prompt.
 *
 * Bands on EVIDENCE SUBSTANCE + VERIFICATION STATE, deliberately not on support ratio:
 * the ratio's denominator differs by claim shape (a document fragment carries a ~346-char
 * reading, a bundle theme is a ~72-char title), so the same evidence scores 0.25 or 1.90
 * depending on where it came from. Ratio is only comparable within a claim shape.
 *
 *   strong — verified against a real source AND substantial
 *   weak   — thin evidence, or verification actually failed
 *   middle — substantial but unverifiable (every bundle), or verified but slighter
 */
function tranche(it) {
  const ev = it.excerpt.length
  if (it.verification === 'failed' || ev < 45) return 'weak'
  if (it.verification === 'verified' && ev >= 90) return 'strong'
  return 'middle'
}

for (const it of items) it.tranche = tranche(it)

const order = { strong: 0, middle: 1, weak: 2 }
items.sort((a, b) => order[a.tranche] - order[b.tranche])

const fixture = {
  generatedAt: new Date().toISOString().slice(0, 10),
  provenance: 'Real output from the 2026-09-04 excerpt spikes (§14, §15). Nothing invented.',
  counts: {
    total: items.length,
    strong: items.filter(i => i.tranche === 'strong').length,
    middle: items.filter(i => i.tranche === 'middle').length,
    weak: items.filter(i => i.tranche === 'weak').length,
    verbatim: items.filter(i => i.type === 'verbatim').length,
    interpretation: items.filter(i => i.type === 'interpretation').length,
    unverifiable: items.filter(i => i.verification === 'unverifiable').length,
  },
  items,
}

fs.writeFileSync(OUT, JSON.stringify(fixture, null, 2))
console.log(`wrote ${OUT}`)
console.table([fixture.counts])
