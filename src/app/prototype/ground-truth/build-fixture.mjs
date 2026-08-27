/**
 * PROTOTYPE: build the ground-truth preflight fixture from real capture data.
 *
 * Source: the A-control arm of the 2026-08-26 model-upgrade capture set, first
 * synthesis run (the context-bundle import path). Real model output on the
 * joinery memo, including the calibration-anchor invention proven present at
 * this stage ("builders keep estimates opaque to protect margin").
 *
 * Receipts are derived HEURISTICALLY here (best-matching sentence in the source
 * fragments by content-word overlap). In production the excerpt would be emitted
 * by full_synthesis itself — that is what pre-registered question 3 is testing.
 *
 *   node src/app/prototype/ground-truth/build-fixture.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const CAPTURES =
  '/Users/Jonny/My Drive (jonny@humventures.com.au)/05-Initiatives/Lunastak/' +
  'Test-Data/20260826-model-upgrade/captures/A-control'

// The first synthesis run ends before this timestamp; everything after is the
// second (doc-upload) run, which we deliberately exclude to keep one coherent pass.
const RUN_ONE_BEFORE = 1787715400000

const STOPWORDS = new Set(
  ('a an and are as at be but by for from has have in into is it its of on or that the their ' +
   'there these they this to was were will with you your not no can could would should may ' +
   'might do does did done than then them we our us i he she his her which who whom what when ' +
   'where how why all any both each more most other some such only own same so too very just')
    .split(' ')
)

const words = (s) =>
  s.toLowerCase().match(/[a-z][a-z'-]+/g)?.filter((w) => w.length > 2 && !STOPWORDS.has(w)) ?? []

/**
 * A fragment is structured markdown — an assertion line, then optional
 * "Evidence:" bullets — not prose. Split it into the units a receipt could
 * honestly quote, tagging where each came from: an evidence bullet is real
 * source material, the assertion line is the fragment restating itself.
 */
function receiptUnits(text) {
  const units = []
  let inEvidence = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line === '---') continue
    if (/^Evidence:$/i.test(line)) {
      inEvidence = true
      continue
    }
    const from = inEvidence || line.startsWith('-') ? 'evidence' : 'claim'
    const body = line.replace(/^[-*]\s*/, '')
    // Long bullets and prose lines still carry several sentences.
    const parts = body.split(/(?<=[.!?])\s+(?=[A-Z"'\u201c])/).map((s) => s.trim())
    for (const part of parts) if (part.length > 25) units.push({ text: part, from })
  }
  return units
}

/** Best-matching source unit for a theme, by content-word overlap. */
function receiptFor(theme, fragments) {
  const target = new Set(words(theme))
  if (target.size === 0) return null
  let best = null
  for (const frag of fragments) {
    for (const unit of receiptUnits(frag.text)) {
      const found = words(unit.text)
      if (found.length === 0) continue
      const hits = found.filter((w) => target.has(w)).length
      // Normalise by the theme, not the unit: we want whatever covers the most
      // of the theme, tie-broken toward the tighter quote.
      const score = hits / target.size - found.length / 4000
      if (!best || score > best.score) best = { score, hits, ...unit }
    }
  }
  // Two shared content words is the floor for calling something a receipt.
  return best && best.hits >= 2 ? best : null
}

/** Pull the fragments back out of the prompt the synthesis call was made with. */
function parseFragments(prompt) {
  const body = prompt.split('## Fragments:')[1]?.split('## Your Task:')[0] ?? ''
  return body
    .split(/### Fragment \d+/)
    .slice(1)
    .map((chunk) => {
      const lines = chunk.trim().split('\n')
      const title = lines.find((l) => l.startsWith('Type:'))?.replace('Type:', '').trim() ?? 'theme'
      const text = lines
        .filter((l) => !/^(Type|Confidence|Title):/.test(l))
        .join('\n')
        .trim()
      return { title, text }
    })
    .filter((f) => f.text.length > 0)
}

const titleCase = (dim) =>
  dim
    .toLowerCase()
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

const files = readdirSync(CAPTURES)
  .filter((f) => f.endsWith('full_synthesis.json'))
  .filter((f) => Number(f.split('-')[0]) < RUN_ONE_BEFORE)
  .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]))

const items = []
const groups = []

for (const file of files) {
  const capture = JSON.parse(readFileSync(join(CAPTURES, file), 'utf8'))
  const prompt = capture.request.messages[0].content
  const dimension = titleCase(prompt.match(/dimension: \*\*(.+?)\*\*/)[1])
  const synthesis = JSON.parse(capture.text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''))
  const fragments = parseFragments(prompt)

  groups.push({ dimension, themeCount: synthesis.keyThemes.length, fragmentCount: fragments.length })

  synthesis.keyThemes.forEach((theme, i) => {
    const receipt = receiptFor(theme, fragments)
    items.push({
      id: `${basename(file, '.json').split('-')[1]}-${i + 1}`,
      statement: theme,
      receipt: receipt?.text ?? null,
      // 'evidence' = quoted source material; 'claim' = the fragment restating
      // its own assertion, which is not really a receipt at all.
      receiptSource: receipt?.from ?? null,
      group: dimension,
      source: { capture: file, model: capture.model, capturedAt: capture.capturedAt },
    })
  })
}

const fixture = {
  generatedFrom: 'captures/A-control (2026-08-26 model-upgrade), first synthesis run',
  note:
    'Real full_synthesis output on the joinery memo. Receipts are heuristically ' +
    'derived from the source fragments, not emitted by the model — see pre-registered question 3.',
  itemCount: items.length,
  withReceipt: items.filter((i) => i.receipt).length,
  withEvidenceReceipt: items.filter((i) => i.receiptSource === 'evidence').length,
  groups,
  items,
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'fixture.json')
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n')
console.log(`${items.length} interpretations across ${groups.length} dimensions → ${out}`)
console.log(
  `${fixture.withReceipt} carry a receipt ` +
    `(${fixture.withEvidenceReceipt} quote evidence, ` +
    `${fixture.withReceipt - fixture.withEvidenceReceipt} only restate the fragment's own claim)`
)
