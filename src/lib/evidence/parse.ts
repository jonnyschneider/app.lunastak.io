/**
 * Parse the ground-truth elements out of a single `<theme>` block.
 *
 * Both extractors — the conversation one (`src/app/api/extract/route.ts`) and the document one
 * (`src/lib/document-processing.ts`) — emit the same `<type>` and `<evidence><span>` shape, so the
 * parsing lives here once rather than being copied into each.
 *
 * Pure string work: no I/O, no model calls, no environment.
 *
 * Backwards compatibility is load-bearing. Today's format carries neither element, and captured
 * fixtures plus any response in flight when this ships must keep parsing — so both are optional and
 * an absent `<type>` is read as NO claim (`undefined`), neither interpretation nor verbatim.
 */
import { extractXML } from '@/lib/utils'

export type InterpretationType = 'verbatim' | 'interpretation'

export interface ThemeEvidence {
  /** Verbatim spans the theme rests on. Empty for a response in today's format. */
  evidence: string[]
  /**
   * Self-reported by the extractor, and `undefined` when it reported nothing (absent element, or
   * an unrecognised value). Absent self-report is NOT a claim — not of interpretation, and not of
   * the stronger `verbatim` either. §16.1: this field decides which question the ground-truth
   * check asks the user, so a defaulted value asks on the strength of a report never made.
   */
  type?: InterpretationType
}

/**
 * @param themeXML the inner XML of one `<theme>` element (not the whole `<extraction>` document)
 */
export function parseThemeEvidence(themeXML: string): ThemeEvidence {
  const type = extractXML(themeXML, 'type')?.trim().toLowerCase()

  const evidence: string[] = []
  const evidenceXML = extractXML(themeXML, 'evidence')
  if (evidenceXML) {
    const spanRe = /<span>([\s\S]*?)<\/span>/g
    let s
    while ((s = spanRe.exec(evidenceXML)) !== null) evidence.push(s[1].trim())
  }

  return {
    evidence,
    type: type === 'interpretation' || type === 'verbatim' ? type : undefined,
  }
}
