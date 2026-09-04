import { describe, it, expect } from 'vitest'
import { parseThemeEvidence } from '@/lib/evidence/parse'

/**
 * Ground-truth check (2026-09-04) — the span/type parsing shared by the conversation extractor
 * (`parseEmergentThemes`) and the document extractor (`parseDocumentThemes`). Pure string work,
 * so it is tested here directly rather than through either route.
 */
describe('parseThemeEvidence', () => {
  it('parses type and evidence spans, preserving span order', () => {
    const themeXML = `
    <theme_name>Pricing Opacity</theme_name>
    <content>Builders keep pricing opaque.</content>
    <type>verbatim</type>
    <evidence>
      <span>builders keep it opaque, mostly</span>
      <span>so they can't estimate it properly</span>
    </evidence>`

    expect(parseThemeEvidence(themeXML)).toEqual({
      type: 'verbatim',
      evidence: ['builders keep it opaque, mostly', "so they can't estimate it properly"],
    })
  })

  it('reads an interpretation self-report, case-insensitively', () => {
    expect(parseThemeEvidence('<type>INTERPRETATION</type>').type).toBe('interpretation')
    expect(parseThemeEvidence('<type>  interpretation  </type>').type).toBe('interpretation')
  })

  it('trims a multi-line span', () => {
    const themeXML = `
    <evidence>
      <span>
        the margin is the first thing to go
      </span>
    </evidence>`

    expect(parseThemeEvidence(themeXML).evidence).toEqual([
      'the margin is the first thing to go',
    ])
  })

  // BACKWARDS COMPATIBILITY — today's format carries neither element. Old captured fixtures and
  // any response already in flight when this ships must keep parsing, with no undefined blowups.
  it("parses today's format, which has neither <type> nor <evidence>", () => {
    const themeXML = `
    <theme_name>Customer Pain Points</theme_name>
    <content>SMBs struggle with complex invoicing workflows.</content>
    <dimensions>
      <dimension name="customer_market" confidence="high"/>
    </dimensions>`

    // No self-report is not a claim of interpretation — it defaults to verbatim.
    expect(parseThemeEvidence(themeXML)).toEqual({ evidence: [], type: 'verbatim' })
  })

  it('defaults type to verbatim when <evidence> is present but <type> is absent', () => {
    const themeXML = `
    <evidence>
      <span>this is the span it rests on</span>
    </evidence>`

    expect(parseThemeEvidence(themeXML)).toEqual({
      evidence: ['this is the span it rests on'],
      type: 'verbatim',
    })
  })

  it('yields an empty evidence array when <evidence> is present but carries no spans', () => {
    expect(parseThemeEvidence('<type>interpretation</type>\n<evidence>\n</evidence>')).toEqual({
      evidence: [],
      type: 'interpretation',
    })
  })

  it('treats an unrecognised type self-report as verbatim', () => {
    expect(parseThemeEvidence('<type>paraphrase</type>').type).toBe('verbatim')
  })
})
