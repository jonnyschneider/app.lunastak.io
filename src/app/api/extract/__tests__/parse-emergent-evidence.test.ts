// @vitest-environment node
/**
 * Ground-truth check (2026-09-04) — the conversation extractor must parse the verbatim span each
 * theme rests on, plus the extractor's self-reported verbatim|interpretation type.
 *
 * The span/type parsing itself now lives in `src/lib/evidence/parse.ts` and is unit-tested there,
 * against a bare `<theme>` body and with no workarounds. What is left here is the end-to-end pass:
 * `parseEmergentThemes` over whole `<extraction>` XML, since that is the function the route calls.
 *
 * The backwards-compatibility case matters as much as the new one: captured fixtures and any
 * in-flight model response still use today's format, which carries neither element.
 */
// The route module builds the Anthropic client at import time, and pulls in next/server — hence
// the node environment and the dummy key. vi.hoisted runs before the import below; no call is made,
// parseEmergentThemes is pure string work.
vi.hoisted(() => {
  process.env.ANTHROPIC_API_KEY ||= 'test-key-not-used';
});

import { parseEmergentThemes } from '../route';

describe('parseEmergentThemes — evidence and type', () => {
  it('parses type and evidence spans per theme, preserving order', () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Trust Gap</theme_name>
    <content>Reasoning across several points.</content>
    <dimensions>
      <dimension name="customer_market" confidence="medium"/>
    </dimensions>
    <type>interpretation</type>
    <evidence>
      <span>they don't trust the quote</span>
      <span>so they can't estimate it properly</span>
    </evidence>
  </theme>
  <theme>
    <theme_name>Quoting Practice</theme_name>
    <content>What the builder actually does today.</content>
    <dimensions>
      <dimension name="go_to_market" confidence="low"/>
    </dimensions>
    <type>VERBATIM</type>
    <evidence>
      <span>I quote off a spreadsheet</span>
    </evidence>
  </theme>
</extraction>`;

    const themes = parseEmergentThemes(xml);

    expect(themes).toHaveLength(2);
    expect(themes.map((t) => t.type)).toEqual(['interpretation', 'verbatim']);
    expect(themes[0].evidence).toEqual([
      "they don't trust the quote",
      "so they can't estimate it properly",
    ]);
    expect(themes[1].evidence).toEqual(['I quote off a spreadsheet']);
    // The new elements must not disturb what was already parsed.
    expect(themes[0].theme_name).toBe('Trust Gap');
    expect(themes[0].dimensions).toEqual([{ name: 'customer_market', confidence: 'MEDIUM' }]);
  });

  // BACKWARDS COMPATIBILITY — today's format carries neither element. Old captured fixtures and
  // any response already in flight when this ships must keep parsing, with no undefined blowups.
  it("parses today's format, which has neither <type> nor <evidence>", () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Customer Pain Points</theme_name>
    <content>SMBs struggle with complex invoicing workflows.</content>
    <dimensions>
      <dimension name="customer_market" confidence="high"/>
      <dimension name="problem_opportunity" confidence="medium"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Technical Differentiation</theme_name>
    <content>AI-powered automation reduces manual work.</content>
    <dimensions>
      <dimension name="capabilities_assets" confidence="high"/>
    </dimensions>
  </theme>
</extraction>`;

    const themes = parseEmergentThemes(xml);

    expect(themes).toHaveLength(2);
    expect(themes[0].theme_name).toBe('Customer Pain Points');
    expect(themes[0].dimensions).toHaveLength(2);
    expect(themes[0].evidence).toEqual([]);
    // No self-report is not a claim of interpretation — it defaults to verbatim.
    expect(themes[0].type).toBe('verbatim');
    expect(themes[1].evidence).toEqual([]);
    expect(themes[1].type).toBe('verbatim');
  });
});
