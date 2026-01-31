// src/lib/prompts/extraction/v1-emergent.ts
import { PromptVersion } from '../types'

export const EMERGENT_EXTRACTION_V1: PromptVersion = {
  id: 'v1-emergent',
  description: 'Theme extraction with inline dimension tagging',
  current: true,
  createdAt: '2025-01-01',
  requiredInputs: ['conversation'],
  template: `You are analyzing a business strategy conversation. Extract the key themes that emerged naturally from the discussion, and tag each theme with the strategic dimensions it relates to.

Conversation:
{conversation}

STRATEGIC DIMENSIONS (tag each theme with 1-3 relevant dimensions):
1. customer_market - Who we serve, their problems, buying behaviour, market dynamics
2. problem_opportunity - The problem space, opportunity size, why now, market need
3. value_proposition - What we offer, how it solves problems, why it matters
4. differentiation_advantage - What makes us unique, defensibility, moats
5. competitive_landscape - Who else plays, their strengths/weaknesses, positioning
6. business_model_economics - How we create/capture value, unit economics, pricing
7. go_to_market - Sales strategy, customer success, growth channels
8. product_experience - The experience we're creating, usability, customer journey
9. capabilities_assets - What we can do, team, technology, IP
10. risks_constraints - What could go wrong, dependencies, limitations

DO NOT force the conversation into predefined categories. Instead, identify 3-7 key themes that actually emerged and name them based on what was discussed.

Examples of emergent themes (adapt to actual conversation):
- "Customer Pain Points" → dimensions: customer_market, problem_opportunity
- "Market Positioning" → dimensions: competitive_landscape, differentiation_advantage
- "Technical Differentiation" → dimensions: capabilities_assets, differentiation_advantage
- "Growth Economics" → dimensions: business_model_economics, go_to_market

Format your extraction:

<extraction>
  <theme>
    <theme_name>Name that describes this theme</theme_name>
    <content>Detailed summary of what was discussed about this theme</content>
    <dimensions>
      <dimension name="dimension_key" confidence="high|medium|low"/>
      <!-- Include 1-3 most relevant dimensions per theme -->
    </dimensions>
  </theme>
  <!-- Repeat for each emergent theme (3-7 themes) -->
</extraction>`,
}
