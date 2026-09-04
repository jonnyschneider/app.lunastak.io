// @vitest-environment node
/**
 * Ground-truth check (2026-09-04) — the conversation extractor must parse the verbatim span each
 * theme rests on, plus the extractor's self-reported verbatim|interpretation type.
 *
 * The backwards-compatibility case matters as much as the new one: captured fixtures and any
 * in-flight model response still use today's format, which carries neither element.
 */
// The route module builds the Anthropic client at import time. vi.hoisted runs before the import
// below, so a dummy key is in place; no call is made — parseEmergentThemes is pure string work.
vi.hoisted(() => {
  process.env.ANTHROPIC_API_KEY ||= 'test-key-not-used';
});

import { parseEmergentThemes } from '../route';

describe('parseEmergentThemes — evidence and type', () => {
  it('parses type and evidence spans, preserving span order', () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Pricing Opacity</theme_name>
    <content>Builders keep pricing opaque, which stalls the buyer.</content>
    <dimensions>
      <dimension name="business_model_economics" confidence="high"/>
    </dimensions>
    <type>verbatim</type>
    <evidence>
      <span>builders keep it opaque, mostly</span>
      <span>so they can't estimate it properly</span>
    </evidence>
  </theme>
</extraction>`;

    const themes = parseEmergentThemes(xml);

    expect(themes).toHaveLength(1);
    expect(themes[0].theme_name).toBe('Pricing Opacity');
    expect(themes[0].type).toBe('verbatim');
    expect(themes[0].evidence).toEqual([
      'builders keep it opaque, mostly',
      "so they can't estimate it properly",
    ]);
  });

  it('parses an interpretation type across multiple themes independently', () => {
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

    expect(themes.map((t) => t.type)).toEqual(['interpretation', 'verbatim']);
    expect(themes[0].evidence).toEqual(["they don't trust the quote"]);
    expect(themes[1].evidence).toEqual(['I quote off a spreadsheet']);
  });

  it('parses a multi-line span, trimmed', () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Margin</theme_name>
    <content>Margin pressure.</content>
    <type>verbatim</type>
    <evidence>
      <span>
        the margin is the first thing to go
      </span>
    </evidence>
  </theme>
</extraction>`;

    expect(parseEmergentThemes(xml)[0].evidence).toEqual([
      'the margin is the first thing to go',
    ]);
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

  it('defaults type to verbatim when <evidence> is present but <type> is absent', () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Half Adopted</theme_name>
    <content>A producer partway through the rollout.</content>
    <evidence>
      <span>this is the span it rests on</span>
    </evidence>
  </theme>
</extraction>`;

    const themes = parseEmergentThemes(xml);

    expect(themes[0].type).toBe('verbatim');
    expect(themes[0].evidence).toEqual(['this is the span it rests on']);
  });

  it('yields an empty evidence array when <evidence> is present but carries no spans', () => {
    const xml = `
<extraction>
  <theme>
    <theme_name>Empty</theme_name>
    <content>Nothing quotable.</content>
    <type>interpretation</type>
    <evidence>
    </evidence>
  </theme>
</extraction>`;

    const themes = parseEmergentThemes(xml);

    expect(themes[0].evidence).toEqual([]);
    expect(themes[0].type).toBe('interpretation');
  });
});
