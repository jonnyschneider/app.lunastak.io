/**
 * "Ground truths" everywhere, never "insights" — the one vocabulary every surface shares
 * (ingest-messaging.ts). The Rebuild dialog's preparing step still said "insights" after the
 * 2026-09-11 rewording, caught on #36's preview. Pinned on the source so no string in the dialog
 * can bring it back.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

describe('GenerationConfirmDialog vocabulary', () => {
  it('never says "insight"', () => {
    const src = fs.readFileSync(path.join(__dirname, '../GenerationConfirmDialog.tsx'), 'utf-8')
    const strings = src.match(/'[^'\n]*'|`[^`\n]*`/g) ?? []
    expect(strings.filter(s => /insight/i.test(s))).toEqual([])
  })
})
