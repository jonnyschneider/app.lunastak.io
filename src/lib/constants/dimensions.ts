/**
 * Tier 1 Strategic Dimensions
 * See: docs/plans/strategic/TAXONOMY_REFERENCE.md
 */
export const TIER_1_DIMENSIONS = [
  'CUSTOMER_MARKET',
  'PROBLEM_OPPORTUNITY',
  'VALUE_PROPOSITION',
  'DIFFERENTIATION_ADVANTAGE',
  'COMPETITIVE_LANDSCAPE',
  'BUSINESS_MODEL_ECONOMICS',
  'GO_TO_MARKET',
  'PRODUCT_EXPERIENCE',
  'CAPABILITIES_ASSETS',
  'RISKS_CONSTRAINTS',
  'STRATEGIC_INTENT',
] as const

export type Tier1Dimension = typeof TIER_1_DIMENSIONS[number]

/**
 * Dimension taxonomy context for conversation prompting
 * Source: docs/plans/strategic/TAXONOMY_REFERENCE.md
 */
interface DimensionContext {
  name: string
  understanding: string[]
  frameworks: string
}

export const DIMENSION_CONTEXT: Record<Tier1Dimension, DimensionContext> = {
  CUSTOMER_MARKET: {
    name: 'Customer & Market',
    understanding: [
      'Who are the target customers/users?',
      'What are their problems, needs, jobs-to-be-done?',
      'How do they buy? Who decides?',
      'What is the market size and dynamics?',
      'How is the market segmented?',
    ],
    frameworks: 'Jobs-to-be-Done (Christensen), Customer segments, Buyers vs. users, Market sizing (TAM/SAM/SOM)',
  },
  PROBLEM_OPPORTUNITY: {
    name: 'Problem & Opportunity',
    understanding: [
      'What problem are we solving?',
      'Why does this problem exist?',
      'Why now? What has changed?',
      'How big is the opportunity?',
      'What happens if the problem isn\'t solved?',
    ],
    frameworks: 'Rumelt\'s Diagnosis, Problem-Solution Fit, Timing and market readiness',
  },
  VALUE_PROPOSITION: {
    name: 'Value Proposition',
    understanding: [
      'What do we offer?',
      'How does it solve the problem?',
      'Why does it matter to customers?',
      'What is the value delivered?',
      'What is the "job" we do for customers?',
    ],
    frameworks: 'Value Proposition Canvas (Osterwalder), Jobs-to-be-Done outcomes, Lafley/Martin "How to Win"',
  },
  DIFFERENTIATION_ADVANTAGE: {
    name: 'Differentiation & Advantage',
    understanding: [
      'What makes us unique?',
      'Why can\'t competitors easily copy this?',
      'What is our "right to win"?',
      'What moats or powers do we have/could develop?',
    ],
    frameworks: 'Helmer\'s 7 Powers: Scale Economies, Network Economies, Counter-Positioning, Switching Costs, Branding, Cornered Resource, Process Power',
  },
  COMPETITIVE_LANDSCAPE: {
    name: 'Competitive Landscape',
    understanding: [
      'Who are the competitors (direct and indirect)?',
      'What are their strengths and weaknesses?',
      'How are we positioned relative to them?',
      'What substitutes exist?',
      'What are barriers to entry?',
    ],
    frameworks: 'Porter\'s Five Forces: Competitive Rivalry, Threat of New Entrants, Threat of Substitutes, Bargaining Power of Suppliers/Buyers',
  },
  BUSINESS_MODEL_ECONOMICS: {
    name: 'Business Model & Economics',
    understanding: [
      'How do we make money?',
      'What is the pricing model?',
      'What are the unit economics (CAC, LTV, margins)?',
      'How does the business scale?',
      'What is the path to profitability?',
    ],
    frameworks: 'Business Model Canvas (Osterwalder), Unit economics (SaaS metrics), Lafley/Martin "Capabilities" and "Management Systems"',
  },
  GO_TO_MARKET: {
    name: 'Go-to-Market',
    understanding: [
      'How do we reach customers?',
      'What is the sales model?',
      'How do we acquire customers?',
      'How do we retain and grow customers?',
      'What channels do we use?',
    ],
    frameworks: 'Lafley/Martin "Where to Play", Sales-led vs. product-led growth, Customer success strategy',
  },
  PRODUCT_EXPERIENCE: {
    name: 'Product Experience',
    understanding: [
      'What experience are we creating?',
      'How do customers interact with the product?',
      'What is the customer journey?',
      'How usable is the product?',
      'What is the "ideal journey"?',
    ],
    frameworks: 'Customer journey mapping, Usability (Cagan\'s usability risk), Product-market fit signals',
  },
  CAPABILITIES_ASSETS: {
    name: 'Capabilities & Assets',
    understanding: [
      'What can we do well?',
      'What do we have (team, tech, IP, data)?',
      'What capabilities are required to win?',
      'What capabilities are we missing?',
      'What is our technical architecture?',
    ],
    frameworks: 'Lafley/Martin "Must-Have Capabilities", Resource-based view, Technical due diligence',
  },
  RISKS_CONSTRAINTS: {
    name: 'Risks & Constraints',
    understanding: [
      'What could go wrong?',
      'What are the dependencies?',
      'What constraints limit us?',
      'What trade-offs must we navigate?',
    ],
    frameworks: 'Cagan\'s 4 Big Risks: Value Risk, Usability Risk, Feasibility Risk, Business Viability Risk. Plus: Regulatory, Competitive response, Technology, Team execution, Market timing',
  },
  STRATEGIC_INTENT: {
    name: 'Strategic Intent',
    understanding: [
      'What are the aspirational goals?',
      'What directional preferences exist?',
      'What does success look like?',
    ],
    frameworks: 'Vision statements, Mission alignment, Long-term ambition',
  },
}
