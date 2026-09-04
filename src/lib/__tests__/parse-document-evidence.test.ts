// @vitest-environment node
/**
 * Ground-truth check (2026-09-04), Task 7 — the DOCUMENT extractor must parse the verbatim span
 * each theme rests on, plus the extractor's self-reported verbatim|interpretation type.
 *
 * The parsing itself is the shared helper in `src/lib/evidence/parse.ts`, unit-tested in
 * `evidence-parse.test.ts`. What is covered here is the end-to-end pass: `parseDocumentThemes`
 * over whole `<extraction>` XML, which is what `processDocument` actually calls.
 *
 * Backwards compatibility is as load-bearing as the new behaviour: captured fixtures and any
 * in-flight model response still use today's format, which carries neither element.
 */
// document-processing.ts builds the Anthropic client at import time (via @/lib/claude), so a dummy
// key must be in place before the import below. vi.hoisted runs first; no call is made — the
// parser under test is pure string work.
vi.hoisted(() => {
  process.env.ANTHROPIC_API_KEY ||= 'test-key-not-used';
});

import { parseDocumentThemes, DOCUMENT_EXTRACTION_PROMPT } from '@/lib/document-processing';

describe('parseDocumentThemes — evidence and type', () => {
  it('parses type and evidence spans per theme, preserving order', () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Launch Sequencing</theme_name>
    <content>Reasoning across several sections of the document.</content>
    <dimensions>
      <dimension name="go_to_market" confidence="high"/>
    </dimensions>
    <type>interpretation</type>
    <evidence>
      <span>we ship the narrow wedge first</span>
      <span>the broad platform can wait a year</span>
    </evidence>
  </theme>
  <theme>
    <theme_name>Pricing Stance</theme_name>
    <content>What the document states outright about price.</content>
    <dimensions>
      <dimension name="business_model_economics" confidence="medium"/>
    </dimensions>
    <type>VERBATIM</type>
    <evidence>
      <span>price is not the lever here</span>
    </evidence>
  </theme>
</extraction>`;

    const themes = parseDocumentThemes(xml);

    expect(themes).toHaveLength(2);
    expect(themes.map((t) => t.type)).toEqual(['interpretation', 'verbatim']);
    expect(themes[0].evidence).toEqual([
      'we ship the narrow wedge first',
      'the broad platform can wait a year',
    ]);
    expect(themes[1].evidence).toEqual(['price is not the lever here']);
    // The new elements must not disturb what was already parsed.
    expect(themes[0].theme_name).toBe('Launch Sequencing');
    expect(themes[0].dimensions).toEqual([{ name: 'go_to_market', confidence: 'HIGH' }]);
  });

  // BACKWARDS COMPATIBILITY — today's format carries neither element.
  it("parses today's format, which has neither <type> nor <evidence>", () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Strategic Intent</theme_name>
    <content>The document sets a three-year direction.</content>
    <dimensions>
      <dimension name="strategic_intent" confidence="high"/>
      <dimension name="value_proposition" confidence="low"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Operating Constraints</theme_name>
    <content>Team size caps what can be attempted.</content>
    <dimensions>
      <dimension name="risks_constraints" confidence="medium"/>
    </dimensions>
  </theme>
</extraction>`;

    const themes = parseDocumentThemes(xml);

    expect(themes).toHaveLength(2);
    expect(themes[0].theme_name).toBe('Strategic Intent');
    expect(themes[0].dimensions).toHaveLength(2);
    expect(themes[0].evidence).toEqual([]);
    // No self-report is no claim at all — not the stronger 'verbatim' claim.
    expect(themes[0].type).toBeUndefined();
    expect(themes[1].evidence).toEqual([]);
    expect(themes[1].type).toBeUndefined();
  });
});

describe('DOCUMENT_EXTRACTION_PROMPT', () => {
  // The wording is not ours to improve: it is the arm-C wording from
  // scripts/one-offs/excerpt-spike.ts, which measured 119/119 spans verified across four real
  // documents. A machine check that it is still byte-identical lives alongside this test.
  it('asks for both <type> and a verbatim <evidence><span>, inside the <theme> block', () => {
    expect(DOCUMENT_EXTRACTION_PROMPT).toContain('<type>verbatim OR interpretation');
    expect(DOCUMENT_EXTRACTION_PROMPT).toContain('A span copied VERBATIM from the document');

    const themeBlock = DOCUMENT_EXTRACTION_PROMPT.slice(
      DOCUMENT_EXTRACTION_PROMPT.indexOf('  <theme>'),
      DOCUMENT_EXTRACTION_PROMPT.indexOf('  </theme>')
    );
    expect(themeBlock).toContain('<type>');
    expect(themeBlock).toContain('<evidence>');
    expect(themeBlock).toContain('</evidence>');
  });
});
