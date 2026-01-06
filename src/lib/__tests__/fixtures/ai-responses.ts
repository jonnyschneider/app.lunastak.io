// src/lib/__tests__/fixtures/ai-responses.ts
/**
 * AI Response Fixtures
 *
 * Deterministic responses for smoke testing without calling Claude API.
 * These are realistic examples that match actual API response format.
 */

export const MOCK_EXTRACTION_RESPONSE = `<extraction>
  <theme>
    <theme_name>Customer Pain Points</theme_name>
    <content>Small businesses struggle with manual invoice processing, leading to delayed payments and cash flow issues.</content>
    <dimensions>
      <dimension name="customer_market" confidence="high"/>
      <dimension name="problem_opportunity" confidence="high"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Technical Approach</theme_name>
    <content>AI-powered OCR and automation can reduce processing time by 80%.</content>
    <dimensions>
      <dimension name="capabilities_assets" confidence="high"/>
      <dimension name="differentiation_advantage" confidence="medium"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Market Positioning</theme_name>
    <content>Focus on underserved SMB segment that can't afford enterprise solutions.</content>
    <dimensions>
      <dimension name="competitive_landscape" confidence="medium"/>
      <dimension name="value_proposition" confidence="high"/>
    </dimensions>
  </theme>
</extraction>`;

export const MOCK_SUMMARY_RESPONSE = `<summary>
  <strengths>
    <strength>Clear understanding of customer pain points in the SMB invoicing space</strength>
    <strength>Differentiated technical approach using AI automation</strength>
  </strengths>
  <emerging>
    <area>Market positioning strategy is starting to take shape</area>
  </emerging>
  <opportunities_for_enrichment>
    <opportunity>Explore specific go-to-market channels for SMB acquisition</opportunity>
    <opportunity>Define pricing model and unit economics</opportunity>
  </opportunities_for_enrichment>
  <thought_prompt>How will you reach your first 100 paying customers?</thought_prompt>
</summary>`;

export const MOCK_GENERATION_RESPONSE = `<thoughts>
Based on the emergent themes, this business has a clear value proposition around AI-powered invoice automation for SMBs. The customer pain points are well-understood, and the technical differentiation is compelling. The strategy should focus on accessibility and ease of adoption.
</thoughts>
<statements>
  <vision>To eliminate invoice processing pain for every small business</vision>
  <strategy>Build the most accessible AI-powered invoicing platform that SMBs can adopt in minutes, not weeks</strategy>
  <objectives>
1. Achieve 100 paying customers within 6 months by targeting accounting-adjacent businesses | Growth | from 0 to 100 | 6M
2. Reduce average invoice processing time by 80% compared to manual methods | Product | 80% reduction | 3M
3. Maintain customer satisfaction score above 4.5/5 during beta | Quality | ≥4.5 NPS | 3M
  </objectives>
</statements>`;

// Parsed versions for direct use in tests
export const MOCK_EMERGENT_EXTRACTION = {
  themes: [
    {
      theme_name: 'Customer Pain Points',
      content: 'Small businesses struggle with manual invoice processing, leading to delayed payments and cash flow issues.',
      dimensions: [
        { name: 'customer_market', confidence: 'HIGH' as const },
        { name: 'problem_opportunity', confidence: 'HIGH' as const },
      ],
    },
    {
      theme_name: 'Technical Approach',
      content: 'AI-powered OCR and automation can reduce processing time by 80%.',
      dimensions: [
        { name: 'capabilities_assets', confidence: 'HIGH' as const },
        { name: 'differentiation_advantage', confidence: 'MEDIUM' as const },
      ],
    },
    {
      theme_name: 'Market Positioning',
      content: 'Focus on underserved SMB segment that can\'t afford enterprise solutions.',
      dimensions: [
        { name: 'competitive_landscape', confidence: 'MEDIUM' as const },
        { name: 'value_proposition', confidence: 'HIGH' as const },
      ],
    },
  ],
  reflective_summary: {
    strengths: [
      'Clear understanding of customer pain points in the SMB invoicing space',
      'Differentiated technical approach using AI automation',
    ],
    emerging: ['Market positioning strategy is starting to take shape'],
    opportunities_for_enrichment: [
      'Explore specific go-to-market channels for SMB acquisition',
      'Define pricing model and unit economics',
    ],
    thought_prompt: 'How will you reach your first 100 paying customers?',
  },
  extraction_approach: 'emergent' as const,
};

export const MOCK_GENERATION_OUTPUT = {
  thoughts: 'Based on the emergent themes, this business has a clear value proposition...',
  statements: {
    vision: 'To eliminate invoice processing pain for every small business',
    strategy: 'Build the most accessible AI-powered invoicing platform that SMBs can adopt in minutes, not weeks',
    objectives: [
      {
        id: 'obj-1',
        pithy: 'Achieve 100 paying customers within 6 months',
        metric: {
          summary: '100 customers',
          full: 'Achieve 100 paying customers within 6 months by targeting accounting-adjacent businesses',
          category: 'Growth',
        },
        explanation: 'Validate product-market fit with paying customers',
        successCriteria: '100+ paying customers on monthly plans',
      },
    ],
    opportunities: [],
    principles: [],
  },
};

// Mock fragment creation result
export const MOCK_FRAGMENT_CREATION_RESULT = {
  fragments: [
    {
      id: 'frag_1',
      projectId: 'proj_test',
      conversationId: 'conv_test',
      content: 'Small businesses struggle with manual invoice processing, leading to delayed payments and cash flow issues.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_2',
      projectId: 'proj_test',
      conversationId: 'conv_test',
      content: 'AI-powered OCR and automation can reduce processing time by 80%.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_3',
      projectId: 'proj_test',
      conversationId: 'conv_test',
      content: 'Focus on underserved SMB segment that can\'t afford enterprise solutions.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'MEDIUM' as const,
    },
  ],
  dimensionTags: [
    { id: 'tag_1', fragmentId: 'frag_1', dimension: 'customer_market' as const, confidence: 'HIGH' as const },
    { id: 'tag_2', fragmentId: 'frag_1', dimension: 'problem_opportunity' as const, confidence: 'HIGH' as const },
    { id: 'tag_3', fragmentId: 'frag_2', dimension: 'capabilities_assets' as const, confidence: 'HIGH' as const },
    { id: 'tag_4', fragmentId: 'frag_2', dimension: 'differentiation_advantage' as const, confidence: 'MEDIUM' as const },
    { id: 'tag_5', fragmentId: 'frag_3', dimension: 'competitive_landscape' as const, confidence: 'MEDIUM' as const },
    { id: 'tag_6', fragmentId: 'frag_3', dimension: 'value_proposition' as const, confidence: 'HIGH' as const },
  ],
};
