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

export interface ParsedTheme {
  theme_name: string;
  content: string;
  dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[];
  /** Verbatim spans the theme rests on. Empty for a response in today's format. */
  evidence: string[];
  /** Self-reported by the extractor. Absent when it reported nothing — that is not a claim. */
  type?: 'verbatim' | 'interpretation';
}

/**
 * Parse an `<extraction>` payload into themes. Must keep parsing responses that carry
 * neither `<type>` nor `<evidence>` — today's format has neither.
 *
 * ⚠ Lives here, not in the route that calls it. It was previously exported from
 * `src/app/api/extract/route.ts` purely so a test could import it, which is not a legal
 * App Router export — `next build` rejects any route export that isn't a handler or a
 * known config field, and the branch failed its first preview build on exactly that.
 * `tsc --noEmit` cannot see it, so `npm run verify` passed throughout.
 */
export function parseEmergentThemes(xml: string): ParsedTheme[] {
  const themes: ParsedTheme[] = [];
  const themeRegex = /<theme>([\s\S]*?)<\/theme>/g;
  let match;

  while ((match = themeRegex.exec(xml)) !== null) {
    const themeXML = match[1];
    const theme_name = extractXML(themeXML, 'theme_name');
    const content = extractXML(themeXML, 'content');

    // Ground-truth check (2026-09-04): the verbatim span the theme rests on, plus the extractor's
    // own verbatim|interpretation call. Both absent in today's format — that must still parse.
    const { evidence, type } = parseThemeEvidence(themeXML);

    // Parse inline dimensions
    const dimensions: { name: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];
    const dimensionRegex = /<dimension\s+name="([^"]+)"\s+confidence="([^"]+)"\s*\/>/g;
    let dimMatch;

    while ((dimMatch = dimensionRegex.exec(themeXML)) !== null) {
      const name = dimMatch[1];
      const confidence = dimMatch[2].toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW';
      if (['HIGH', 'MEDIUM', 'LOW'].includes(confidence)) {
        dimensions.push({ name, confidence });
      }
    }

    if (theme_name && content) {
      themes.push({
        theme_name,
        content,
        dimensions,
        evidence,
        type,
      });
    }
  }

  return themes;
}
