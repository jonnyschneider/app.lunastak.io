/**
 * Chunk tagging must survive the tagging response as the model actually writes it.
 *
 * Real failure, 2026-09-10 (Costco demo-fixture rerun): a 67-chunk bundle imported "successfully"
 * — 72 fragments, 117 evidence rows, provenance stamped — with every single chunk tagged
 * STRATEGIC_INTENT/LOW. That is the `||` fallback in `transformContextBundle`, not a tagging
 * result. The sole signal was a console.warn on a server nobody was reading.
 *
 * Cause: the transform extracted the <tagging> wrapper with `extractXML` before parsing. That
 * helper runs `dropStrayClosingTags`, whose tag regex `<(\/?)([a-zA-Z_][\w-]*)>` cannot match a
 * tag carrying ATTRIBUTES. `<chunk index="0">` was therefore never registered as an opener, every
 * `</chunk>` looked like a closer with no opener, and all of them were deleted as "model noise" —
 * leaving content that `chunkTagRegex` could not match.
 *
 * Fix: parse the chunks off the raw response. The wrapper extraction bought nothing, and
 * `knowledge-summary.ts` already parses its own attributed tag (`<gap dimension="...">`) straight
 * off `responseText`, which is why that call site never broke.
 *
 * These tests pin the PARSE, not the LLM: they assert that a well-formed tagging response yields
 * real dimensions, and — the part that actually failed — that nothing silently degrades to the
 * fallback. A test that only checked "67 fragments created" passed throughout the outage.
 */

const CHUNK_TAG_REGEX = /<chunk index="(\d+)">([\s\S]*?)<\/chunk>/g
const DIMENSION_REGEX = /<dimension\s+name="([^"]+)"\s+confidence="([^"]+)"\s*\/>/g

/** Mirrors the parse in `transformContextBundle`. */
function parseTags(responseText: string): Map<number, Array<{ name: string; confidence: string }>> {
  const tagsByIndex = new Map<number, Array<{ name: string; confidence: string }>>()
  const chunkRe = new RegExp(CHUNK_TAG_REGEX.source, 'g')

  let chunkMatch: RegExpExecArray | null
  while ((chunkMatch = chunkRe.exec(responseText)) !== null) {
    const index = parseInt(chunkMatch[1])
    const dims: Array<{ name: string; confidence: string }> = []
    const dimRe = new RegExp(DIMENSION_REGEX.source, 'g')
    let dimMatch: RegExpExecArray | null
    while ((dimMatch = dimRe.exec(chunkMatch[2])) !== null) {
      dims.push({ name: dimMatch[1], confidence: dimMatch[2].toUpperCase() })
    }
    tagsByIndex.set(index, dims)
  }
  return tagsByIndex
}

const WELL_FORMED = `<tagging>
  <chunk index="0">
    <dimension name="customer_market" confidence="high"/>
    <dimension name="business_model_economics" confidence="medium"/>
  </chunk>
  <chunk index="1">
    <dimension name="competitive_landscape" confidence="high"/>
  </chunk>
</tagging>`

describe('context bundle — chunk tagging parse (the 2026-09-10 silent fallback)', () => {
  it('parses every chunk from a well-formed tagging response', () => {
    const tags = parseTags(WELL_FORMED)
    expect(tags.size).toBe(2)
    expect(tags.get(0)).toEqual([
      { name: 'customer_market', confidence: 'HIGH' },
      { name: 'business_model_economics', confidence: 'MEDIUM' },
    ])
    expect(tags.get(1)).toEqual([{ name: 'competitive_landscape', confidence: 'HIGH' }])
  })

  it('does not depend on the <tagging> wrapper being present', () => {
    const noWrapper = WELL_FORMED.replace('<tagging>', '').replace('</tagging>', '')
    expect(parseTags(noWrapper).size).toBe(2)
  })

  it('REGRESSION: routing the response through extractXML destroys every chunk', async () => {
    // This is the exact failure. `extractXML` strips the attributed openers' closing tags, so the
    // parse yields nothing and every chunk silently takes the strategic_intent/LOW fallback.
    // If this ever stops failing, `dropStrayClosingTags` has been made attribute-aware (follow-up
    // B) and the defensive parse below can be reconsidered.
    const { extractXML } = await import('@/lib/utils')
    expect(parseTags(extractXML(WELL_FORMED, 'tagging')).size).toBe(0)

    // …while parsing the raw response, which is what the transform now does, recovers all of them.
    expect(parseTags(WELL_FORMED).size).toBe(2)
  })

  it('tolerates prose around the tagging block', () => {
    const chatty = `Here are the tags you asked for:\n\n${WELL_FORMED}\n\nLet me know if you'd like changes.`
    expect(parseTags(chatty).size).toBe(2)
  })
})
