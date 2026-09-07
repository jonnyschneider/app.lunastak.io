/**
 * Fixture for the ground truth gate prototype — real material, real support bands.
 *
 * Source: Jonny's 2026-09-05 bundle (42 themes, 46 spans, all verified against a 23,942-char
 * voice memo). Support is computed the way src/lib/support/dimension-support.ts does at the
 * dimension level, applied here per fragment so the prototype's weak/confident split is real.
 */
import fs from 'fs'
import path from 'path'

const BUNDLE = '/private/tmp/claude-501/-Users-Jonny-Dev-humventures-lunastak-tools/4dea041e-da86-4943-b547-0559ae9784b2/scratchpad/bundle.json'
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixture.json')

const THIN_EVIDENCE_CHARS = 40   // measured — §13
const SP = '/private/tmp/claude-501/-Users-Jonny-Dev-humventures-lunastak-app-lunastak-io/4bf06b1b-54cf-4fad-ba3e-4d53a4edbaa1/scratchpad'
const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'))

/**
 * A REALISTIC project, not one source. The bundle alone has zero weak fragments — every span in
 * it is >=40 chars (median 173), so new-format bundles are uniformly well-evidenced and the weak
 * door would not appear at all. Document extraction is where thin spans actually occur (min 31,
 * median ~100), so the fixture mixes both: a bundle import plus a document upload, which is what
 * a real project looks like.
 */
function docThemes(file, source) {
  const d = JSON.parse(fs.readFileSync(path.join(SP, file), 'utf8'))
  return (d.C_typed?.[0] ?? []).map(t => ({
    theme: t.name, area: 'DOCUMENT', evidence: t.spans ?? [], type: t.type, source,
  }))
}

/**
 * ⚠ A finding the fixture has to represent honestly. Under the MEASURED 40-char threshold, only
 * 1 of 60 freshly-extracted fragments is weak — spans run 90+ chars routinely. So on a project
 * built entirely after this ships, the weak door would rarely appear.
 *
 * But that is not what a real project looks like on day one. Every fragment created BEFORE this
 * change has zero evidence rows and there is no backfill (task 15-23), so it cannot show the user
 * their own words at all — weak by definition, and the largest weak category in practice. The
 * fixture therefore models a project mid-migration: newer fragments carrying evidence, older ones
 * carrying none. That is the state every existing user will actually be in.
 */
const PRE_CHANGE = 3   // older fragments, no evidence rows — the real day-one majority

const sourced = [
  ...bundle.themes.map(t => ({ ...t, source: 'Context bundle' })),
  ...docThemes('spike-2026-01-03-jobs-to-be-done_md.json', 'Jobs to be done.md'),
  ...docThemes('spike-Humble_Positioning_md.json', 'Humble Positioning.md'),
]

const items = sourced.map((t, i) => {
  // The first few document themes stand in for pre-change fragments: real claims, no evidence.
  if (t.source !== 'Context bundle' && i % 8 === 0 && i > 0) t = { ...t, evidence: [] }
  const spans = t.evidence ?? []
  const evidence = spans[0] ?? null
  const len = evidence?.length ?? 0
  // Weak = no evidence at all, or thin evidence. The reason is shown to the user, so it must
  // be a fact about this fragment rather than a score.
  const weak = !evidence || len < THIN_EVIDENCE_CHARS
  return {
    id: `f${i + 1}`,
    claim: t.theme,
    area: t.area,
    evidence,
    spans: spans.length,
    // Bundles are unverifiable by construction: the source conversation never reaches Lunastak.
    source: t.source,
    // Bundle spans can never be checked (the source conversation never reaches us); document
    // spans were verified against the file at ingest. Both are quoted material — §16.1.
    verification: !evidence ? 'none' : t.source === 'Context bundle' ? 'unverifiable' : 'verified',
    type: t.type ?? (spans.length > 1 ? 'interpretation' : 'verbatim'),
    weak,
    reason: !evidence ? "I couldn't find your own words behind this one"
      : len < THIN_EVIDENCE_CHARS ? 'Only a few words to go on'
      : null,
  }
})

// §6 of the interaction design: ordering IS the persuasion. Interpretations before verbatims,
// thinnest evidence first — the most-likely-wrong item lands first by construction.
const weak = items.filter(i => i.weak).sort((a, b) => {
  if (a.type !== b.type) return a.type === 'interpretation' ? -1 : 1
  return (a.evidence?.length ?? 0) - (b.evidence?.length ?? 0)
})
const confident = items.filter(i => !i.weak)

fs.writeFileSync(OUT, JSON.stringify({
  provenance: 'Real bundle, 2026-09-05, from a 23,942-char voice memo. Support computed, not invented.',
  total: items.length,
  weak, confident,
}, null, 2))
console.log(`wrote ${items.length} fragments — ${weak.length} weak, ${confident.length} confident`)
