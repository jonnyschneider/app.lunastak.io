/**
 * extractXML must survive a mis-closed tag.
 *
 * Real failure, 2026-08-26 (model-bump experiment, opus-5 @ effort:low):
 * the model emitted
 *
 *   <strategy><headline>…</headline><elaboration>…</elaboration></objectives>
 *
 * — closing <strategy> with </objectives>. The strict `<tag>(.*?)</tag>` match found nothing,
 * returned '', and the app PERSISTED AN EMPTY STRATEGY while the complete, correct content sat
 * in the response. Silent: no exception, no truncation, stop_reason end_turn at 26% of ceiling.
 *
 * Tag imbalance appeared in 8 of 40 XML-bearing responses across ALL four model arms, so this
 * is not a property of any one model.
 *
 * Recovery rule: if the closing tag is absent, take content from the opening tag up to the next
 * tag that cannot be part of this section — and never invent content that was not there.
 */

import { extractXML, extractAllXML } from '@/lib/utils'

describe('extractXML — well-formed input (unchanged behaviour)', () => {
  it('extracts a simple pair', () => {
    expect(extractXML('<a>hello</a>', 'a')).toBe('hello')
  })
  it('extracts across newlines', () => {
    expect(extractXML('<a>\n  line1\n  line2\n</a>', 'a')).toBe('line1\n  line2')
  })
  it('takes the FIRST pair when several exist', () => {
    expect(extractXML('<a>one</a><a>two</a>', 'a')).toBe('one')
  })
  it('returns empty string when the tag is genuinely absent', () => {
    expect(extractXML('<b>hello</b>', 'a')).toBe('')
  })
  it('does not confuse a prefix tag', () => {
    expect(extractXML('<strategy_notes>x</strategy_notes>', 'strategy')).toBe('')
  })
})

describe('extractXML — mis-closed tag (the 2026-08-26 failure)', () => {
  const REAL = `<statements>
  <vision><headline>V</headline><elaboration>VE</elaboration></vision>
  <strategy>
    <headline>Aggregate custom joinery demand into software.</headline>
    <elaboration>The expensive part is the uncompensated detailing.</elaboration>
  </objectives>
  <objectives>
    <objective><title>T1</title></objective>
  </objectives>
</statements>`

  it('recovers the strategy content despite the wrong closing tag', () => {
    const s = extractXML(REAL, 'strategy')
    expect(s).toContain('Aggregate custom joinery demand')
    expect(s).toContain('uncompensated detailing')
  })

  it('does NOT swallow the following section', () => {
    const s = extractXML(REAL, 'strategy')
    expect(s).not.toContain('<objective>')
    expect(s).not.toContain('T1')
  })

  it('still extracts the well-formed sibling correctly', () => {
    expect(extractXML(REAL, 'vision')).toContain('VE')
    expect(extractXML(REAL, 'objectives')).toContain('T1')
  })

  it('recovers a mis-closed tag at end of input', () => {
    expect(extractXML('<a>tail content', 'a')).toBe('tail content')
  })

  it('never invents content for an absent tag', () => {
    expect(extractXML(REAL, 'nonexistent')).toBe('')
  })
})

describe('extractAllXML — unchanged', () => {
  it('collects every well-formed match', () => {
    expect(extractAllXML('<o>1</o><o>2</o><o>3</o>', 'o')).toEqual(['1', '2', '3'])
  })
  it('returns empty for an absent tag', () => {
    expect(extractAllXML('<x>1</x>', 'o')).toEqual([])
  })
})
