/**
 * Every app-defined window event that something LISTENS for, something must DISPATCH.
 *
 * ⚠ WHY THIS EXISTS. `documentProcessed` was dispatched by `DocumentProcessingProvider`, which was
 * deleted on 2026-09-09 (`9a93e78`) when documents became an ordinary background task — and its
 * replacement correctly emits `extractionComplete` with the same `{ projectId, documentId }` detail.
 * But three listeners on the OLD name survived. Nothing failed: `addEventListener` for an event that
 * never fires is silent. Uploading a document into a deep dive stopped reopening the deep dive, and
 * stayed broken for a release, because a listener with no dispatcher looks exactly like working code.
 *
 * App events are camelCase (`extractionComplete`, `generationComplete`); DOM events are lowercase
 * (`popstate`, `keydown`). So any listened-for name containing an uppercase letter must appear in a
 * `new CustomEvent('…'` / `new Event('…'` somewhere in `src`.
 */
import * as fs from 'fs'
import * as path from 'path'

const SRC = path.join(__dirname, '../..')

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(e.name) ? [full] : []
  })
}

const files = sourceFiles(SRC).map((f) => ({ f: path.relative(SRC, f), s: fs.readFileSync(f, 'utf-8') }))

function collect(re: RegExp): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const { f, s } of files) {
    Array.from(s.matchAll(re)).forEach((m) => out.set(m[1], (out.get(m[1]) ?? []).concat(f)))
  }
  return out
}

describe('app-defined window events', () => {
  const listened = collect(/addEventListener\(\s*['"]([a-z]+[A-Z][A-Za-z]*)['"]/g)
  const dispatched = collect(/new (?:Custom)?Event(?:<[^>]*>)?\(\s*['"]([A-Za-z]+)['"]/g)

  it('finds the events it is meant to police — a regex that matches nothing passes vacuously', () => {
    expect(listened.has('extractionComplete')).toBe(true)
    expect(dispatched.has('extractionComplete')).toBe(true)
  })

  it('every event something listens for is dispatched by something', () => {
    const orphans = Array.from(listened.entries())
      .filter(([name]) => !dispatched.has(name))
      .map(([name, where]) => `${name} — listened for in ${Array.from(new Set(where)).join(', ')}, dispatched nowhere`)
    expect(orphans).toEqual([])
  })
})
