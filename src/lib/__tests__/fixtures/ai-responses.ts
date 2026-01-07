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

// Mock fragment creation result (conversation-sourced)
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

// ============================================
// DOCUMENT UPLOAD PATH FIXTURES
// ============================================

// Mock document record
export const MOCK_DOCUMENT = {
  id: 'doc_test123',
  projectId: 'proj_test',
  fileName: 'business-plan-2024.pdf',
  fileType: 'application/pdf',
  fileSizeBytes: 245000,
  uploadContext: 'Our company business plan for 2024',
  status: 'pending' as const,
};

// Mock extracted text from Unstructured API
export const MOCK_DOCUMENT_TEXT = `
Executive Summary

Our company, InvoiceAI, is revolutionizing how small businesses handle their invoicing.
We've identified that 73% of SMBs still process invoices manually, leading to an average
of 14 days in payment delays.

Market Opportunity

The SMB invoicing market is valued at $4.2B and growing at 12% annually. Our target
segment—businesses with 10-50 employees—is particularly underserved by current solutions
that are either too expensive or too complex.

Our Solution

InvoiceAI uses proprietary OCR and machine learning to automate invoice processing with
99.2% accuracy. Unlike competitors, we offer a self-service model that requires no
implementation support.

Go-to-Market Strategy

We will initially target accounting firms as channel partners, as they serve multiple SMB
clients and can drive rapid adoption through trusted relationships.
`;

// Mock document extraction response (Claude)
export const MOCK_DOCUMENT_EXTRACTION_RESPONSE = `<extraction>
  <theme>
    <theme_name>SMB Invoice Processing Pain</theme_name>
    <content>73% of SMBs still process invoices manually, leading to an average of 14 days in payment delays. This represents a significant operational inefficiency.</content>
    <dimensions>
      <dimension name="customer_market" confidence="high"/>
      <dimension name="problem_opportunity" confidence="high"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Market Size and Growth</theme_name>
    <content>The SMB invoicing market is valued at $4.2B and growing at 12% annually. Target segment of businesses with 10-50 employees is underserved.</content>
    <dimensions>
      <dimension name="customer_market" confidence="high"/>
      <dimension name="competitive_landscape" confidence="medium"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Technical Differentiation</theme_name>
    <content>Proprietary OCR and machine learning achieving 99.2% accuracy. Self-service model requiring no implementation support differentiates from competitors.</content>
    <dimensions>
      <dimension name="differentiation_advantage" confidence="high"/>
      <dimension name="capabilities_assets" confidence="high"/>
    </dimensions>
  </theme>
  <theme>
    <theme_name>Channel Partner Strategy</theme_name>
    <content>Initial go-to-market through accounting firms as channel partners, leveraging their trusted relationships with multiple SMB clients.</content>
    <dimensions>
      <dimension name="go_to_market" confidence="high"/>
      <dimension name="business_model_economics" confidence="medium"/>
    </dimensions>
  </theme>
</extraction>`;

// Parsed document themes (matches EmergentThemeContract)
export const MOCK_DOCUMENT_THEMES = [
  {
    theme_name: 'SMB Invoice Processing Pain',
    content: '73% of SMBs still process invoices manually, leading to an average of 14 days in payment delays. This represents a significant operational inefficiency.',
    dimensions: [
      { name: 'customer_market', confidence: 'HIGH' as const },
      { name: 'problem_opportunity', confidence: 'HIGH' as const },
    ],
  },
  {
    theme_name: 'Market Size and Growth',
    content: 'The SMB invoicing market is valued at $4.2B and growing at 12% annually. Target segment of businesses with 10-50 employees is underserved.',
    dimensions: [
      { name: 'customer_market', confidence: 'HIGH' as const },
      { name: 'competitive_landscape', confidence: 'MEDIUM' as const },
    ],
  },
  {
    theme_name: 'Technical Differentiation',
    content: 'Proprietary OCR and machine learning achieving 99.2% accuracy. Self-service model requiring no implementation support differentiates from competitors.',
    dimensions: [
      { name: 'differentiation_advantage', confidence: 'HIGH' as const },
      { name: 'capabilities_assets', confidence: 'HIGH' as const },
    ],
  },
  {
    theme_name: 'Channel Partner Strategy',
    content: 'Initial go-to-market through accounting firms as channel partners, leveraging their trusted relationships with multiple SMB clients.',
    dimensions: [
      { name: 'go_to_market', confidence: 'HIGH' as const },
      { name: 'business_model_economics', confidence: 'MEDIUM' as const },
    ],
  },
];

// Mock fragment creation result (document-sourced - no conversationId)
export const MOCK_DOCUMENT_FRAGMENT_CREATION_RESULT = {
  fragments: [
    {
      id: 'frag_doc_1',
      projectId: 'proj_test',
      documentId: 'doc_test123',
      content: '73% of SMBs still process invoices manually, leading to an average of 14 days in payment delays.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_doc_2',
      projectId: 'proj_test',
      documentId: 'doc_test123',
      content: 'The SMB invoicing market is valued at $4.2B and growing at 12% annually.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_doc_3',
      projectId: 'proj_test',
      documentId: 'doc_test123',
      content: 'Proprietary OCR and machine learning achieving 99.2% accuracy.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
    {
      id: 'frag_doc_4',
      projectId: 'proj_test',
      documentId: 'doc_test123',
      content: 'Initial go-to-market through accounting firms as channel partners.',
      contentType: 'theme' as const,
      status: 'active' as const,
      confidence: 'HIGH' as const,
    },
  ],
  dimensionTags: [
    { id: 'tag_doc_1', fragmentId: 'frag_doc_1', dimension: 'customer_market' as const, confidence: 'HIGH' as const },
    { id: 'tag_doc_2', fragmentId: 'frag_doc_1', dimension: 'problem_opportunity' as const, confidence: 'HIGH' as const },
    { id: 'tag_doc_3', fragmentId: 'frag_doc_2', dimension: 'customer_market' as const, confidence: 'HIGH' as const },
    { id: 'tag_doc_4', fragmentId: 'frag_doc_2', dimension: 'competitive_landscape' as const, confidence: 'MEDIUM' as const },
    { id: 'tag_doc_5', fragmentId: 'frag_doc_3', dimension: 'differentiation_advantage' as const, confidence: 'HIGH' as const },
    { id: 'tag_doc_6', fragmentId: 'frag_doc_3', dimension: 'capabilities_assets' as const, confidence: 'HIGH' as const },
    { id: 'tag_doc_7', fragmentId: 'frag_doc_4', dimension: 'go_to_market' as const, confidence: 'HIGH' as const },
    { id: 'tag_doc_8', fragmentId: 'frag_doc_4', dimension: 'business_model_economics' as const, confidence: 'MEDIUM' as const },
  ],
};
