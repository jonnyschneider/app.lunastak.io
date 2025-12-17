# E1a: Emergent Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement feature-flagged emergent extraction variant that lets themes emerge naturally from conversation instead of using prescriptive schema.

**Architecture:** Add Statsig SDK for feature flagging, create parallel extraction/generation logic paths, adapt UI to handle both prescriptive and emergent schemas.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Statsig SDK, Claude API

---

## Task 1: Statsig SDK Setup

**Files:**
- Modify: `package.json`
- Create: `src/lib/statsig.ts`
- Modify: `.env.local`

**Step 1: Install Statsig SDK**

Run: `npm install statsig-node`
Expected: Package installed successfully

**Step 2: Add Statsig environment variables**

Add to `.env.local`:
```bash
STATSIG_SERVER_SECRET_KEY=your-key-here
```

Note: User will need to create Statsig account and get actual key

**Step 3: Create Statsig client utility**

Create: `src/lib/statsig.ts`

```typescript
import Statsig from 'statsig-node';

let statsigInitialized = false;

export async function initializeStatsig() {
  if (!statsigInitialized && process.env.STATSIG_SERVER_SECRET_KEY) {
    await Statsig.initialize(process.env.STATSIG_SERVER_SECRET_KEY, {
      environment: { tier: process.env.NODE_ENV || 'development' },
    });
    statsigInitialized = true;
  }
}

export async function checkFeatureGate(
  userId: string,
  gateName: string
): Promise<boolean> {
  await initializeStatsig();

  if (!process.env.STATSIG_SERVER_SECRET_KEY) {
    // Fallback to baseline if Statsig not configured
    return false;
  }

  return Statsig.checkGate({ userID: userId }, gateName);
}

export async function getExperimentVariant(userId: string): Promise<string> {
  const isEmergentEnabled = await checkFeatureGate(userId, 'emergent_extraction_e1a');
  return isEmergentEnabled ? 'emergent-extraction-e1a' : 'baseline-v1';
}

export function shutdownStatsig() {
  if (statsigInitialized) {
    Statsig.shutdown();
    statsigInitialized = false;
  }
}
```

**Step 4: Verify Statsig integration**

Run: `npm run type-check`
Expected: No type errors

**Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/statsig.ts .env.local
git commit -m "feat: add Statsig SDK for feature flagging"
```

---

## Task 2: Type Definitions for Emergent Extraction

**Files:**
- Modify: `src/lib/types.ts:93-116`

**Step 1: Add emergent extraction types**

Add after line 106 in `src/lib/types.ts`:

```typescript
export interface EmergentTheme {
  theme_name: string;
  content: string;
}

export interface EmergentExtractedContext {
  themes: EmergentTheme[];
  reflective_summary: ReflectiveSummary;
  extraction_approach: 'emergent';
}

export interface PrescriptiveExtractedContext {
  core: {
    industry: string;
    target_market: string;
    unique_value: string;
  };
  enrichment: EnrichmentFields;
  reflective_summary: ReflectiveSummary;
  extraction_approach: 'prescriptive';
}

// Union type for both approaches
export type ExtractedContextVariant = EmergentExtractedContext | PrescriptiveExtractedContext;

// Type guard
export function isEmergentContext(context: ExtractedContextVariant): context is EmergentExtractedContext {
  return context.extraction_approach === 'emergent';
}

export function isPrescriptiveContext(context: ExtractedContextVariant): context is PrescriptiveExtractedContext {
  return context.extraction_approach === 'prescriptive';
}
```

**Step 2: Verify types**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add type definitions for emergent extraction"
```

---

## Task 3: Update Conversation Start with Variant Detection

**Files:**
- Modify: `src/app/api/conversation/start/route.ts`

**Step 1: Import Statsig utility**

Add to imports at top of `src/app/api/conversation/start/route.ts`:

```typescript
import { getExperimentVariant } from '@/lib/statsig';
```

**Step 2: Update conversation creation with dynamic variant**

Replace lines 23-29:

```typescript
    // Determine experiment variant
    const experimentVariant = await getExperimentVariant(userId);

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        status: 'in_progress',
        experimentVariant,
      },
    });
```

**Step 3: Verify changes**

Run: `npm run type-check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/conversation/start/route.ts
git commit -m "feat: integrate Statsig variant assignment in conversation start"
```

---

## Task 4: Emergent Extraction Logic

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Step 1: Add emergent extraction prompt constant**

Add after line 30 in `src/app/api/extract/route.ts`:

```typescript
const EMERGENT_EXTRACTION_PROMPT = `You are analyzing a business strategy conversation. Extract the key themes that emerged naturally from the discussion.

Conversation:
{conversation}

DO NOT force the conversation into predefined categories. Instead, identify 3-7 key themes that actually emerged and name them based on what was discussed.

Examples of emergent themes (adapt to actual conversation):
- "Customer Pain Points" if they discussed specific problems
- "Market Positioning" if they discussed competitive landscape
- "Technical Differentiation" if they discussed unique capabilities
- "Growth Economics" if they discussed business model
- "Operational Challenges" if they discussed execution concerns

Format your extraction:

<extraction>
  <theme>
    <theme_name>Name that describes this theme</theme_name>
    <content>Detailed summary of what was discussed about this theme</content>
  </theme>
  <!-- Repeat for each emergent theme (3-7 themes) -->
</extraction>`;
```

**Step 2: Add helper function for parsing emergent themes**

Add after line 69:

```typescript
function parseEmergentThemes(xml: string): { theme_name: string; content: string }[] {
  const themes: { theme_name: string; content: string }[] = [];
  const themeRegex = /<theme>(.*?)<\/theme>/gs;
  let match;

  while ((match = themeRegex.exec(xml)) !== null) {
    const themeXML = match[1];
    const theme_name = extractXML(themeXML, 'theme_name');
    const content = extractXML(themeXML, 'content');

    if (theme_name && content) {
      themes.push({ theme_name, content });
    }
  }

  return themes;
}
```

**Step 3: Update POST handler to support both approaches**

Replace the entire POST function (lines 71-184) with:

```typescript
export async function POST(req: Request) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Build conversation history
    const conversationHistory = conversation.messages
      .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');

    // Determine extraction approach based on experiment variant
    const isEmergent = conversation.experimentVariant === 'emergent-extraction-e1a';
    const extractionPrompt = isEmergent
      ? EMERGENT_EXTRACTION_PROMPT.replace('{conversation}', conversationHistory)
      : EXTRACTION_PROMPT.replace('{conversation}', conversationHistory);

    // Extract context
    const startTime = Date.now();
    const extractionResponse = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: extractionPrompt
      }],
      temperature: 0.3
    });

    const extractionContent = extractionResponse.content[0]?.type === 'text'
      ? extractionResponse.content[0].text : '';

    const extractionXML = extractXML(extractionContent, 'extraction');

    let extractedContext: any;

    if (isEmergent) {
      // Parse emergent themes
      const themes = parseEmergentThemes(extractionXML);

      // Generate reflective summary (same for both approaches)
      const summaryResponse = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)
        }],
        temperature: 0.5
      });

      const summaryContent = summaryResponse.content[0]?.type === 'text'
        ? summaryResponse.content[0].text : '';
      const summaryXML = extractXML(summaryContent, 'summary');

      const reflective_summary = {
        strengths: extractAllXML(summaryXML, 'strength'),
        emerging: extractAllXML(summaryXML, 'area'),
        opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
        thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
      };

      extractedContext = {
        themes,
        reflective_summary,
        extraction_approach: 'emergent',
      };
    } else {
      // Prescriptive extraction (baseline-v1)
      const coreXML = extractXML(extractionXML, 'core');
      const enrichmentXML = extractXML(extractionXML, 'enrichment');

      const core = {
        industry: extractXML(coreXML, 'industry'),
        target_market: extractXML(coreXML, 'target_market'),
        unique_value: extractXML(coreXML, 'unique_value'),
      };

      const enrichment: any = {};
      if (enrichmentXML) {
        const competitiveContext = extractXML(enrichmentXML, 'competitive_context');
        if (competitiveContext) enrichment.competitive_context = competitiveContext;

        const customerSegments = extractXML(enrichmentXML, 'customer_segments');
        if (customerSegments) enrichment.customer_segments = customerSegments.split(',').map(s => s.trim());

        const operationalCaps = extractXML(enrichmentXML, 'operational_capabilities');
        if (operationalCaps) enrichment.operational_capabilities = operationalCaps;

        const techAdvantages = extractXML(enrichmentXML, 'technical_advantages');
        if (techAdvantages) enrichment.technical_advantages = techAdvantages;
      }

      // Generate reflective summary
      const summaryResponse = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: REFLECTIVE_SUMMARY_PROMPT.replace('{conversation}', conversationHistory)
        }],
        temperature: 0.5
      });

      const summaryContent = summaryResponse.content[0]?.type === 'text'
        ? summaryResponse.content[0].text : '';
      const summaryXML = extractXML(summaryContent, 'summary');

      const reflective_summary = {
        strengths: extractAllXML(summaryXML, 'strength'),
        emerging: extractAllXML(summaryXML, 'area'),
        opportunities_for_enrichment: extractAllXML(summaryXML, 'opportunity'),
        thought_prompt: extractXML(summaryXML, 'thought_prompt') || undefined,
      };

      extractedContext = {
        core,
        enrichment,
        reflective_summary,
        extraction_approach: 'prescriptive',
      };
    }

    return NextResponse.json({
      extractedContext,
    });
  } catch (error) {
    console.error('Extract context error:', error);
    return NextResponse.json(
      { error: 'Failed to extract context' },
      { status: 500 }
    );
  }
}
```

**Step 4: Verify changes**

Run: `npm run type-check`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat: implement emergent extraction logic with feature flag"
```

---

## Task 5: Emergent Confidence Assessment

**Files:**
- Modify: `src/app/api/conversation/assess-confidence/route.ts`

**Step 1: Add emergent confidence assessment prompt**

Add after line 32 in `src/app/api/conversation/assess-confidence/route.ts`:

```typescript
const EMERGENT_CONFIDENCE_ASSESSMENT_PROMPT = `Evaluate this business strategy conversation for readiness to generate quality strategy output.

Conversation:
{conversation}

Assessment Criteria:

1. STRATEGIC UNDERSTANDING - Do you have enough context to generate meaningful Vision/Mission/Objectives?
   - Enough concrete detail about the business
   - Clear understanding of what matters to them
   - Sufficient context about their situation

2. SPECIFICITY - Are responses concrete enough to work with?
   - Specific enough to generate resonant strategy statements
   - Clear enough to identify strengths and opportunities
   - Sufficient for generating strategy that feels authentic to their business

Remember: We're not checking if prescribed fields are filled. We're assessing if we understand their business well enough to generate strategy that will resonate.

Return your assessment:
<assessment>
  <confidence>HIGH or MEDIUM or LOW</confidence>
  <reasoning>Brief explanation (1-2 sentences) about strategic understanding</reasoning>
</assessment>`;
```

**Step 2: Update POST handler to use appropriate prompt**

Replace lines 34-75 with:

```typescript
export async function POST(req: Request) {
  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Get conversation with messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Build conversation history
    const conversationHistory = conversation.messages
      .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n');

    // Determine assessment approach based on experiment variant
    const isEmergent = conversation.experimentVariant === 'emergent-extraction-e1a';
    const assessmentPrompt = isEmergent
      ? EMERGENT_CONFIDENCE_ASSESSMENT_PROMPT.replace('{conversation}', conversationHistory)
      : CONFIDENCE_ASSESSMENT_PROMPT.replace('{conversation}', conversationHistory);

    // Assess confidence
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: assessmentPrompt
      }],
      temperature: 0.3
    });
    const latency = Date.now() - startTime;

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const assessmentXML = extractXML(content, 'assessment');
    const confidence = extractXML(assessmentXML, 'confidence') as ConfidenceLevel;
    const reasoning = extractXML(assessmentXML, 'reasoning');

    return NextResponse.json({
      confidenceScore: confidence || 'MEDIUM',
      confidenceReasoning: reasoning || 'Unable to assess confidence',
      latencyMs: latency,
    });
  } catch (error) {
    console.error('Assess confidence error:', error);
    return NextResponse.json(
      { error: 'Failed to assess confidence' },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify changes**

Run: `npm run type-check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/conversation/assess-confidence/route.ts
git commit -m "feat: add emergent confidence assessment logic"
```

---

## Task 6: Adaptive Generation Logic

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Step 1: Add emergent generation prompt**

Add after line 48:

```typescript
const EMERGENT_GENERATION_PROMPT = `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging patterns:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Mission: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your reasoning about the strategy, referencing specific themes that emerged</thoughts>
<statements>
  <vision>The vision statement</vision>
  <mission>The mission statement</mission>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`;
```

**Step 2: Import type utilities**

Add to imports at top:

```typescript
import { ExtractedContextVariant, isEmergentContext } from '@/lib/types';
```

**Step 3: Update POST handler to support both schemas**

Replace lines 50-112 with:

```typescript
export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log('[Generate API] Request started');

  try {
    const { conversationId, extractedContext } = await req.json();
    console.log('[Generate API] Parsed request body, conversationId:', conversationId);

    if (!conversationId || !extractedContext) {
      console.error('[Generate API] Missing required fields');
      return NextResponse.json(
        { error: 'conversationId and extractedContext are required' },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      console.error('[Generate API] Conversation not found:', conversationId);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    console.log('[Generate API] Conversation found, preparing context...');
    const context = extractedContext as ExtractedContextVariant;

    let prompt: string;

    if (isEmergentContext(context)) {
      // Emergent generation
      const themesText = context.themes
        .map(theme => `${theme.theme_name}:\n${theme.content}`)
        .join('\n\n');

      const strengthsText = (context.reflective_summary?.strengths || [])
        .map(s => `- ${s}`)
        .join('\n');

      const emergingText = (context.reflective_summary?.emerging || [])
        .map(e => `- ${e}`)
        .join('\n');

      const opportunitiesText = (context.reflective_summary?.opportunities_for_enrichment || [])
        .map((opp: string) => `- ${opp}`)
        .join('\n');

      prompt = EMERGENT_GENERATION_PROMPT
        .replace('{themes}', themesText)
        .replace('{strengths}', strengthsText || 'None identified')
        .replace('{emerging}', emergingText || 'None identified')
        .replace('{unexplored}', opportunitiesText || 'None identified');
    } else {
      // Prescriptive generation (baseline-v1)
      const enrichmentText = Object.entries(context.enrichment || {})
        .filter(([_, value]) => value)
        .map(([key, value]) => {
          const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
        })
        .join('\n');

      const strengthsText = (context.reflective_summary?.strengths || [])
        .map(s => `- ${s}`)
        .join('\n');

      const emergingText = (context.reflective_summary?.emerging || [])
        .map(e => `- ${e}`)
        .join('\n');

      const opportunitiesText = (context.reflective_summary?.opportunities_for_enrichment || [])
        .map((opp: string) => `- ${opp}`)
        .join('\n');

      prompt = GENERATION_PROMPT
        .replace('{industry}', context.core.industry)
        .replace('{target_market}', context.core.target_market)
        .replace('{unique_value}', context.core.unique_value)
        .replace('{enrichment}', enrichmentText || 'None provided')
        .replace('{strengths}', strengthsText || 'None identified')
        .replace('{emerging}', emergingText || 'None identified')
        .replace('{unexplored}', opportunitiesText || 'None identified');
    }

    // Generate strategy
    console.log('[Generate API] Calling Claude API...');
    console.log('[Generate API] Prompt length:', prompt.length, 'characters');
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7
    });
    const latency = Date.now() - startTime;
    console.log(`[Generate API] Claude API responded in ${latency}ms`);

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const thoughts = extractXML(content, 'thoughts');
    const statementsXML = extractXML(content, 'statements');

    // Extract objectives as strings and convert to new format
    const objectiveStrings = extractXML(statementsXML, 'objectives')
      .split('\n')
      .filter(line => line.trim().length > 0);

    const statements: StrategyStatements = {
      vision: extractXML(statementsXML, 'vision'),
      mission: extractXML(statementsXML, 'mission'),
      objectives: convertLegacyObjectives(objectiveStrings),
      initiatives: [], // Will be generated as placeholders in UI
      principles: []   // Will be generated as placeholders in UI
    };

    // Save trace
    console.log('[Generate API] Saving trace to database...');
    const trace = await prisma.trace.create({
      data: {
        conversationId,
        userId: conversation.userId,
        extractedContext: extractedContext as any,
        output: statements as any,
        claudeThoughts: thoughts,
        modelUsed: CLAUDE_MODEL,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      },
    });
    console.log('[Generate API] Trace saved with ID:', trace.id);

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'completed' },
    });

    const totalTime = Date.now() - requestStartTime;
    console.log(`[Generate API] Request completed successfully in ${totalTime}ms`);

    return NextResponse.json({
      traceId: trace.id,
      thoughts,
      statements,
    });
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[Generate API] Error after ${totalTime}ms:`, error);
    console.error('[Generate API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to generate strategy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Step 4: Verify changes**

Run: `npm run type-check`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: implement adaptive generation for emergent themes"
```

---

## Task 7: UI Adaptation for Emergent Themes

**Files:**
- Modify: `src/components/ExtractionConfirm.tsx`

**Step 1: Import type utilities**

Add to imports at top:

```typescript
import { ExtractedContextVariant, isEmergentContext } from '@/lib/types';
```

**Step 2: Update props interface**

Replace lines 6-12 with:

```typescript
interface ExtractionConfirmProps {
  extractedContext: ExtractedContextVariant;
  onGenerate: () => void;
  onContinue: () => void;
  onFlagForLater: () => void;
  onDismiss: () => void;
}
```

**Step 3: Replace component implementation**

Replace lines 14-200 with:

```typescript
export default function ExtractionConfirm({
  extractedContext,
  onGenerate,
  onContinue,
  onFlagForLater,
  onDismiss,
}: ExtractionConfirmProps) {
  const isEmergent = isEmergentContext(extractedContext);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Here&apos;s what I understood:</h2>
        </div>

        {/* Dynamic Content based on extraction approach */}
        {isEmergent ? (
          // Emergent themes display
          <div className="space-y-4">
            {extractedContext.themes.map((theme, idx) => (
              <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  {theme.theme_name}
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {theme.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // Prescriptive fields display (baseline-v1)
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Industry
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{extractedContext.core.industry}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Market
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{extractedContext.core.target_market}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Unique Value
                </label>
                <p className="text-zinc-900 dark:text-zinc-100">{extractedContext.core.unique_value}</p>
              </div>
            </div>

            {/* Enrichment Fields Section */}
            {Object.keys(extractedContext.enrichment).length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-3">Additional Context</h3>
                <div className="space-y-3">
                  {Object.entries(extractedContext.enrichment).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <p className="text-zinc-900 dark:text-zinc-100 text-sm">
                        {Array.isArray(value) ? value.join(', ') : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Reflective Summary Section - Same for both */}
        <div className="border-t pt-6 bg-zinc-50 dark:bg-zinc-900 -m-6 p-6 rounded-b-lg">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Reflection</h3>

          {extractedContext.reflective_summary.strengths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">What&apos;s Clear</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-zinc-900 dark:text-zinc-100">{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.emerging.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">What&apos;s Emerging</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.emerging.map((area, idx) => (
                  <li key={idx} className="text-sm text-zinc-900 dark:text-zinc-100">{area}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.opportunities_for_enrichment.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Opportunities for Enrichment</h4>
              <ul className="list-disc list-inside space-y-1">
                {extractedContext.reflective_summary.opportunities_for_enrichment.map((opportunity, idx) => (
                  <li key={idx} className="text-sm text-zinc-900 dark:text-zinc-100">{opportunity}</li>
                ))}
              </ul>
            </div>
          )}

          {extractedContext.reflective_summary.thought_prompt && (
            <div className="bg-white dark:bg-zinc-800 border-l-4 border-zinc-400 dark:border-zinc-500 p-4 rounded">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {extractedContext.reflective_summary.thought_prompt}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Primary Action */}
          <div>
            <button
              onClick={onGenerate}
              className="w-full px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 font-medium"
            >
              Generate my strategy
            </button>
          </div>

          {/* Secondary Actions */}
          {extractedContext.reflective_summary.opportunities_for_enrichment.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Or, explore opportunities for enrichment:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onContinue}
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                >
                  Continue now
                </button>
                <button
                  onClick={onFlagForLater}
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                >
                  Flag for next session
                </button>
                <button
                  onClick={onDismiss}
                  className="flex-1 px-4 py-2 text-zinc-500 dark:text-zinc-500 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Verify changes**

Run: `npm run type-check`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/components/ExtractionConfirm.tsx
git commit -m "feat: adapt ExtractionConfirm UI for emergent themes"
```

---

## Task 8: Dimensional Coverage Analysis Helper

**Files:**
- Create: `scripts/dimensional_coverage.py`

**Step 1: Create dimensional coverage coding helper**

Create: `scripts/dimensional_coverage.py`

```python
"""
Dimensional Coverage Analysis for E1a Emergent Extraction

This script helps researchers code emergent themes to strategic dimensions
for retrospective analysis of whether emergent extraction captures critical
strategic dimensions.
"""

import json
from typing import List, Dict, Any
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

# Strategic dimensions to code for
DIMENSIONS = [
    'customer_market_understanding',
    'value_proposition_differentiation',
    'capabilities_advantages',
    'competitive_context',
    'growth_model',
    'operational_execution',
    'technical_innovation',
]

class DimensionalCoverageAnalyzer:
    def __init__(self):
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL not found in environment")

        self.engine = create_engine(database_url)

    def get_emergent_traces(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get traces from emergent-extraction-e1a variant"""
        query = text("""
            SELECT
                t.id,
                t."conversationId",
                t."extractedContext",
                t.output,
                t."qualityRating",
                c."experimentVariant"
            FROM "Trace" t
            JOIN "Conversation" c ON t."conversationId" = c.id
            WHERE c."experimentVariant" = 'emergent-extraction-e1a'
            ORDER BY t.timestamp DESC
            LIMIT :limit
        """)

        with self.engine.connect() as conn:
            results = conn.execute(query, {"limit": limit})
            traces = []
            for row in results:
                traces.append({
                    'id': row[0],
                    'conversationId': row[1],
                    'extractedContext': row[2],
                    'output': row[3],
                    'qualityRating': row[4],
                    'experimentVariant': row[5],
                })
            return traces

    def display_trace_for_coding(self, trace: Dict[str, Any]):
        """Display trace themes for manual coding"""
        print("\n" + "="*80)
        print(f"Trace ID: {trace['id']}")
        print(f"Quality Rating: {trace['qualityRating'] or 'Not rated'}")
        print("="*80)

        extracted = trace['extractedContext']
        if 'themes' in extracted:
            print("\nEMERGENT THEMES:")
            for idx, theme in enumerate(extracted['themes'], 1):
                print(f"\n{idx}. {theme['theme_name']}")
                print(f"   {theme['content']}")

        print("\n" + "-"*80)
        print("DIMENSIONS TO CODE:")
        for idx, dim in enumerate(DIMENSIONS, 1):
            print(f"{idx}. {dim.replace('_', ' ').title()}")
        print("-"*80)

    def code_trace_dimensions(self, trace_id: str, dimensions_present: List[str]) -> Dict[str, Any]:
        """
        Code which dimensions are present in a trace

        Args:
            trace_id: The trace ID
            dimensions_present: List of dimension names that are present

        Returns:
            Coverage analysis dict
        """
        coverage = {dim: (dim in dimensions_present) for dim in DIMENSIONS}
        coverage_pct = (sum(coverage.values()) / len(DIMENSIONS)) * 100

        return {
            'trace_id': trace_id,
            'dimensions_coded': coverage,
            'coverage_percentage': coverage_pct,
            'dimensions_present_count': sum(coverage.values()),
            'dimensions_missing': [dim for dim, present in coverage.items() if not present],
        }

    def analyze_coverage_distribution(self, coded_traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze coverage distribution across coded traces"""
        if not coded_traces:
            return {}

        total_traces = len(coded_traces)
        avg_coverage = sum(t['coverage_percentage'] for t in coded_traces) / total_traces

        dimension_frequencies = {dim: 0 for dim in DIMENSIONS}
        for trace in coded_traces:
            for dim, present in trace['dimensions_coded'].items():
                if present:
                    dimension_frequencies[dim] += 1

        dimension_percentages = {
            dim: (count / total_traces) * 100
            for dim, count in dimension_frequencies.items()
        }

        return {
            'total_traces_analyzed': total_traces,
            'average_coverage_pct': avg_coverage,
            'dimension_frequencies': dimension_frequencies,
            'dimension_percentages': dimension_percentages,
            'consistently_missing': [
                dim for dim, pct in dimension_percentages.items()
                if pct < 50  # Present in less than 50% of traces
            ],
        }

# Example usage
if __name__ == '__main__':
    print("Dimensional Coverage Analysis for E1a")
    print("="*80)
    print("\nThis helper loads emergent extraction traces and helps you code")
    print("which strategic dimensions are present in each trace.")
    print("\nUsage:")
    print("  analyzer = DimensionalCoverageAnalyzer()")
    print("  traces = analyzer.get_emergent_traces(limit=10)")
    print("  analyzer.display_trace_for_coding(traces[0])")
    print("  coded = analyzer.code_trace_dimensions(traces[0]['id'], ['customer_market_understanding', ...])")
    print("\nSee notebooks/dimensional_coverage_analysis.ipynb for interactive workflow")
```

**Step 2: Commit**

```bash
git add scripts/dimensional_coverage.py
git commit -m "feat: add dimensional coverage analysis helper for E1a"
```

---

## Task 9: Testing Setup

**Files:**
- Create: `tests/e1a-test-plan.md`

**Step 1: Document testing approach**

Create: `tests/e1a-test-plan.md`

```markdown
# E1a Testing Plan

## Manual Testing Checklist

### Local Development Testing

1. **Statsig Configuration**
   - [ ] Set STATSIG_SERVER_SECRET_KEY in .env.local
   - [ ] Create feature gate 'emergent_extraction_e1a' in Statsig dashboard
   - [ ] Set gate to 0% rollout initially

2. **Baseline-v1 Flow (Control)**
   - [ ] Start new conversation with gate OFF
   - [ ] Verify conversation tagged with 'baseline-v1'
   - [ ] Complete 3-5 question flow
   - [ ] Verify extraction shows prescriptive fields (industry, target_market, unique_value)
   - [ ] Verify generation produces Vision/Mission/Objectives
   - [ ] Verify UI displays prescriptive schema correctly

3. **Emergent-e1a Flow (Variant)**
   - [ ] Enable feature gate for test user
   - [ ] Start new conversation
   - [ ] Verify conversation tagged with 'emergent-extraction-e1a'
   - [ ] Complete 3-5 question flow
   - [ ] Verify extraction shows emergent themes (3-7 themes with custom names)
   - [ ] Verify generation uses emergent themes
   - [ ] Verify UI displays themes in card format
   - [ ] Verify reflective summary appears in both variants

4. **Edge Cases**
   - [ ] Test very short conversation (2 questions) - both variants
   - [ ] Test long conversation (8-10 questions) - both variants
   - [ ] Test conversation with very specific business vs. vague business
   - [ ] Verify graceful fallback if Statsig unavailable

### Database Verification

- [ ] Check Conversation.experimentVariant is set correctly
- [ ] Check Trace.extractedContext has correct schema
- [ ] Verify both schemas can be stored in JSON field
- [ ] Query traces by experiment variant

### API Contract Testing

- [ ] `/api/conversation/start` returns correct variant
- [ ] `/api/extract` returns appropriate schema based on variant
- [ ] `/api/generate` accepts both schema types
- [ ] `/api/conversation/assess-confidence` works with both variants

## Integration Test Cases

### Test 1: Baseline-v1 End-to-End

```typescript
// Pseudo-test
// 1. Mock Statsig to return false for emergent gate
// 2. Start conversation
// 3. Assert experimentVariant === 'baseline-v1'
// 4. Continue conversation
// 5. Extract context
// 6. Assert extraction has core.industry, core.target_market, core.unique_value
// 7. Generate strategy
// 8. Assert output has vision, mission, objectives
```

### Test 2: Emergent-e1a End-to-End

```typescript
// Pseudo-test
// 1. Mock Statsig to return true for emergent gate
// 2. Start conversation
// 3. Assert experimentVariant === 'emergent-extraction-e1a'
// 4. Continue conversation
// 5. Extract context
// 6. Assert extraction has themes[] array
// 7. Assert themes have theme_name and content
// 8. Generate strategy
// 9. Assert output has vision, mission, objectives
```

## Pre-Deployment Checklist

- [ ] Type check passes: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing complete (all checkboxes above)
- [ ] Statsig dashboard configured correctly
- [ ] Feature gate set to 0% rollout
- [ ] Environment variables documented
- [ ] Experiment register updated
```

**Step 2: Commit**

```bash
git add tests/e1a-test-plan.md
git commit -m "docs: add E1a testing plan and checklist"
```

---

## Task 10: Update Documentation

**Files:**
- Create: `docs/experiments/one-pagers/E1a-emergent-extraction.md`
- Modify: `docs/experiments/EXPERIMENT_REGISTER.md`

**Step 1: Create E1a one-pager**

Create: `docs/experiments/one-pagers/E1a-emergent-extraction.md`

```markdown
# Experiment E1a: Emergent Extraction

**Status:** 🟡 Implementation Complete, Awaiting Data Collection
**Variant ID:** `emergent-extraction-e1a`
**Date:** 2025-12-17

---

## What We're Learning

Can completely freeform extraction (no prescribed fields) produce less "wooden" outputs than baseline-v1's prescriptive schema, while still capturing the strategic dimensions needed for complete Decision Stack framework?

---

## Hypothesis

Emergent theme extraction will produce less "wooden" outputs than prescriptive fields because it accommodates the user's natural perspective rather than forcing diverse strategic thinking into a one-size-fits-all mold.

**Key assumption:** Users will provide enough signal through natural conversation that Claude can identify meaningful themes without being told what fields to extract.

---

## What Changed from Baseline-v1

### Extraction
**Before:** Fixed core (industry, target_market, unique_value) + prescribed enrichment
**After:** Emergent themes (3-7 themes) named by Claude based on what actually emerged

### Confidence Assessment
**Before:** "Do I have enough for industry/target_market/unique_value?"
**After:** "Do I understand this business strategically?"

### Generation
**Before:** Standard prompts using prescribed fields
**After:** Adaptive prompts using emergent themes

### What Stayed the Same
- 3-10 question adaptive flow
- Reflective summary structure
- Three-option extraction UI
- Vision/Mission/Objectives output format

---

## Implementation Details

**Feature Flag:** `emergent_extraction_e1a` (Statsig)
**Variant Assignment:** Dynamic per user via Statsig SDK
**Code Changes:**
- `src/lib/statsig.ts` - Feature flag integration
- `src/lib/types.ts` - Emergent schema types
- `src/app/api/extract/route.ts` - Dual extraction logic
- `src/app/api/generate/route.ts` - Adaptive generation
- `src/components/ExtractionConfirm.tsx` - Dynamic UI

---

## Success Criteria

**Pass:**
- Higher % "good" quality ratings (researcher) than baseline-v1
- No critical dimensional gaps (>80% coverage)

**Fail:**
- Lower or equal quality ratings
- Systematic gaps in dimensional coverage

**Learn:**
- If quality improves but coverage drops → E1b/E1c (hybrid approaches)

---

## Measurement

**Primary Metrics:**
- Quality rating distribution (% good vs bad)
- User feedback (% helpful vs not_helpful)
- Conversation completion rate

**Secondary Analysis:**
- Dimensional coverage coding (retrospective)
- Theme diversity across conversations
- Coverage gaps analysis

**Sample Size:** 10-15 participants for E1a, 10-15 for baseline-v1

---

## Related Artifacts

- **Design:** `docs/plans/2025-12-17-e1a-emergent-extraction-design.md`
- **Implementation:** `docs/plans/2025-12-17-e1a-emergent-extraction-implementation.md`
- **Testing:** `tests/e1a-test-plan.md`
- **Analysis:** `scripts/dimensional_coverage.py`

---

**Implementation Status:** Complete
**Next Step:** UAT → Enable for test participants → Collect data
```

**Step 2: Update experiment register**

Modify line 16 in `docs/experiments/EXPERIMENT_REGISTER.md`:

```markdown
| **E1a** | `emergent-extraction-e1a` | Completely freeform extraction (no prescribed fields) will produce less "wooden" outputs while maintaining dimensional coverage | 🟡 Implementation Complete | Target: 10-15 | Quality rating (good/bad %), user feedback (helpful %), dimensional coverage (>80%) | TBD | [View](./one-pagers/E1a-emergent-extraction.md) |
```

**Step 3: Commit**

```bash
git add docs/experiments/one-pagers/E1a-emergent-extraction.md docs/experiments/EXPERIMENT_REGISTER.md
git commit -m "docs: add E1a one-pager and update experiment register"
```

---

## Task 11: Final Verification and Deployment Prep

**Files:**
- Create: `docs/deployment/E1A_DEPLOYMENT_GUIDE.md`

**Step 1: Create deployment guide**

Create: `docs/deployment/E1A_DEPLOYMENT_GUIDE.md`

```markdown
# E1a Deployment Guide

## Prerequisites

1. **Statsig Account Setup**
   - Create account at https://statsig.com
   - Create new project for Decision Stack
   - Get server secret key

2. **Feature Gate Configuration**
   - Create feature gate: `emergent_extraction_e1a`
   - Set initial rollout: 0%
   - Configure targeting rules (optional)

3. **Environment Variables**
   ```bash
   STATSIG_SERVER_SECRET_KEY=secret-xxxxxx
   ```

## Deployment Steps

### 1. Local Testing

```bash
# Install dependencies
npm install

# Set environment variables
echo "STATSIG_SERVER_SECRET_KEY=your-key" >> .env.local

# Type check
npm run type-check

# Build
npm run build

# Test locally
npm run dev
```

### 2. Manual Testing Verification

Follow checklist in `tests/e1a-test-plan.md`:
- [ ] Baseline-v1 flow works
- [ ] Emergent-e1a flow works (gate ON)
- [ ] Both schemas store correctly
- [ ] UI displays both variants correctly

### 3. Deploy to Vercel

```bash
# Add Statsig secret to Vercel
vercel env add STATSIG_SERVER_SECRET_KEY

# Deploy
git push origin development
# (Jonny merges to main when ready)
```

### 4. Feature Gate Rollout

**Initial rollout:** 0% - verify deployment works
**Test users:** Enable for specific user IDs
**Gradual rollout:** 10% → 25% → 50% until target sample size reached
**Full rollout:** Only if experiment passes

## Monitoring

### Check Variant Distribution

```sql
SELECT
  "experimentVariant",
  COUNT(*) as conversation_count
FROM "Conversation"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "experimentVariant";
```

### Check Quality Ratings

```sql
SELECT
  c."experimentVariant",
  t."qualityRating",
  COUNT(*) as count
FROM "Trace" t
JOIN "Conversation" c ON t."conversationId" = c.id
WHERE c."experimentVariant" IN ('baseline-v1', 'emergent-extraction-e1a')
  AND t."qualityRating" IS NOT NULL
GROUP BY c."experimentVariant", t."qualityRating"
ORDER BY c."experimentVariant", t."qualityRating";
```

### Statsig Dashboard

Monitor in Statsig:
- Feature gate exposure events
- User distribution
- Auto-captured events

## Rollback Plan

If issues discovered:

1. **Immediate:** Set feature gate to 0% in Statsig
2. **All users revert to baseline-v1**
3. **No code deployment needed**
4. **Investigate issues**
5. **Fix and redeploy if needed**

## Data Collection Timeline

- **Week 1:** Enable for 2-3 test users, verify everything works
- **Week 2-3:** Gradual rollout to reach 10-15 E1a participants
- **Week 4:** Analysis and decision (pass/fail/iterate)

## Success Metrics

Track weekly:
- Conversations completed (baseline vs E1a)
- Quality ratings collected
- User feedback collected
- Conversation completion rate

Target: 10-15 complete traces per variant before analysis
```

**Step 2: Run final verification**

Run: `npm run type-check && npm run build`
Expected: No errors, build succeeds

**Step 3: Commit deployment guide**

```bash
git add docs/deployment/E1A_DEPLOYMENT_GUIDE.md
git commit -m "docs: add E1a deployment guide"
```

**Step 4: Create summary commit**

```bash
git commit --allow-empty -m "feat: E1a emergent extraction complete

Implementation complete for emergent-extraction-e1a variant:
- Statsig SDK integration for feature flagging
- Emergent extraction logic (3-7 themes, no prescribed fields)
- Adaptive confidence assessment (strategic understanding)
- Adaptive generation (uses emergent themes)
- Dynamic UI for both schemas
- Dimensional coverage analysis tooling
- Complete testing plan and deployment guide

Next: UAT → Deploy → Enable for test users → Collect 10-15 traces

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Post-Implementation Tasks

**Not part of implementation, but required before experiment start:**

1. **Statsig Setup (User action required)**
   - Create Statsig account
   - Create feature gate
   - Add secret key to environment
   - Test gate toggling

2. **UAT (User Acceptance Testing)**
   - Test baseline-v1 flow
   - Test emergent-e1a flow
   - Verify database storage
   - Verify UI display

3. **Participant Recruitment**
   - Identify 10-15 test participants for E1a
   - Ensure concurrent baseline-v1 data
   - Brief participants on process

4. **Analysis Preparation**
   - Set up dimensional coverage coding workflow
   - Prepare Jupyter notebooks for analysis
   - Document coding rubric for dimensions

---

## Summary

This plan implements E1a emergent extraction with:
- **11 tasks** covering all implementation needs
- **Bite-sized steps** (2-5 minutes each)
- **TDD where applicable** (configuration-heavy, less traditional TDD)
- **Complete code** in each step
- **Exact file paths** and commands
- **Verification** at each step
- **Frequent commits** with good messages

**Total estimated time:** 3-4 hours for experienced developer with zero context
**Complexity:** Medium (feature flag integration, dual logic paths, type safety)
