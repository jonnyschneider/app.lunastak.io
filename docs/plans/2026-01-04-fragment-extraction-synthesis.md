# Fragment Extraction & Synthesis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Populate the new schema tables (Fragment, FragmentDimensionTag, DimensionalSynthesis, GeneratedOutput, ExtractionRun) by updating the extraction and generation flows.

**Architecture:** The extraction route creates Fragments from emergent themes, tags them with dimensions using dimensional-analysis, then triggers synthesis updates. The generation route creates GeneratedOutput and ExtractionRun for evaluation tracking. All changes are additive - existing Trace flow continues working.

**Tech Stack:** Prisma, TypeScript, Next.js API Routes, Claude API

**Related:**
- Design docs: `docs/plans/strategic/synthesis-algorithm-design.md`
- Schema: `prisma/schema.prisma`
- Dimensions: `src/lib/constants/dimensions.ts`

---

## Phase 1: Fragment Creation from Extraction

**Goal:** When extraction runs, create Fragment records from emergent themes.

---

### Task 1.1: Create Fragment Service Module

**Files:**
- Create: `src/lib/fragments.ts`

**Step 1: Create the fragments service file**

```typescript
/**
 * Fragment service - creates and manages extracted fragments
 */

import { prisma } from '@/lib/db'
import { Tier1Dimension } from '@/lib/constants/dimensions'

export interface FragmentInput {
  projectId: string
  conversationId: string
  messageId?: string
  content: string
  contentType: 'theme' | 'insight' | 'quote' | 'stat' | 'principle'
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  extractedBy?: string
}

export interface DimensionTagInput {
  dimension: Tier1Dimension
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW'
  reasoning?: string
}

/**
 * Create a fragment with optional dimension tags
 */
export async function createFragment(
  input: FragmentInput,
  dimensionTags?: DimensionTagInput[]
) {
  const fragment = await prisma.fragment.create({
    data: {
      projectId: input.projectId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      content: input.content,
      contentType: input.contentType,
      confidence: input.confidence,
      extractedBy: input.extractedBy || 'claude-extraction',
      status: 'active',
      dimensionTags: dimensionTags ? {
        create: dimensionTags.map(tag => ({
          dimension: tag.dimension,
          confidence: tag.confidence,
          reasoning: tag.reasoning,
          taggedBy: 'claude-dimensional-analysis',
        }))
      } : undefined
    },
    include: {
      dimensionTags: true
    }
  })

  return fragment
}

/**
 * Create multiple fragments from extraction themes
 */
export async function createFragmentsFromThemes(
  projectId: string,
  conversationId: string,
  themes: { theme_name: string; content: string }[],
  dimensionMappings: Map<string, DimensionTagInput[]>
) {
  const fragments = await Promise.all(
    themes.map(theme => {
      const tags = dimensionMappings.get(theme.theme_name) || []
      return createFragment({
        projectId,
        conversationId,
        content: `**${theme.theme_name}**\n\n${theme.content}`,
        contentType: 'theme',
        confidence: tags.length > 0 ? 'MEDIUM' : 'LOW',
      }, tags)
    })
  )

  return fragments
}

/**
 * Get active fragments for a project and dimension
 */
export async function getActiveFragments(
  projectId: string,
  dimension?: Tier1Dimension
) {
  return prisma.fragment.findMany({
    where: {
      projectId,
      status: 'active',
      ...(dimension && {
        dimensionTags: {
          some: { dimension }
        }
      })
    },
    include: {
      dimensionTags: true
    },
    orderBy: { capturedAt: 'desc' }
  })
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/fragments.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/fragments.ts
git commit -m "feat(lib): add fragment service for creating and querying fragments"
```

---

### Task 1.2: Create Dimension Mapping Utility

**Files:**
- Modify: `src/lib/dimensional-analysis.ts`

**Step 1: Add function to convert coverage to dimension tags**

At the end of the file, add:

```typescript
import { Tier1Dimension, TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'
import { DimensionTagInput } from '@/lib/fragments'

/**
 * Map from dimensional-analysis dimension names to Tier 1 dimension constants
 */
const DIMENSION_NAME_MAP: Record<string, Tier1Dimension> = {
  'customer_and_market': 'CUSTOMER_MARKET',
  'problem_and_opportunity': 'PROBLEM_OPPORTUNITY',
  'value_proposition': 'VALUE_PROPOSITION',
  'differentiation_and_advantage': 'DIFFERENTIATION_ADVANTAGE',
  'competitive_landscape': 'COMPETITIVE_LANDSCAPE',
  'business_model_and_economics': 'BUSINESS_MODEL_ECONOMICS',
  'go_to_market': 'GO_TO_MARKET',
  'product_experience': 'PRODUCT_EXPERIENCE',
  'capabilities_and_assets': 'CAPABILITIES_ASSETS',
  'risks_and_constraints': 'RISKS_CONSTRAINTS',
}

/**
 * Convert dimensional coverage response to fragment dimension tags
 * Returns a map of theme_name -> dimension tags
 */
export function convertCoverageToDimensionTags(
  coverage: DimensionalCoverage
): Map<string, DimensionTagInput[]> {
  const themeToTags = new Map<string, DimensionTagInput[]>()

  for (const [dimKey, dimValue] of Object.entries(coverage.dimensions)) {
    if (!dimValue.covered) continue

    const tier1Dimension = DIMENSION_NAME_MAP[dimKey]
    if (!tier1Dimension) continue

    for (const themeName of dimValue.themes) {
      const existingTags = themeToTags.get(themeName) || []
      existingTags.push({
        dimension: tier1Dimension,
        confidence: dimValue.confidence.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
        reasoning: `Mapped from dimensional coverage analysis`,
      })
      themeToTags.set(themeName, existingTags)
    }
  }

  return themeToTags
}
```

**Step 2: Add imports at top of file**

```typescript
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { DimensionTagInput } from '@/lib/fragments'
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit src/lib/dimensional-analysis.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/dimensional-analysis.ts
git commit -m "feat(lib): add dimension tag conversion for fragment tagging"
```

---

### Task 1.3: Update Extract Route to Create Fragments

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Step 1: Add imports at top of file**

After existing imports, add:

```typescript
import { createFragmentsFromThemes } from '@/lib/fragments';
import { convertCoverageToDimensionTags } from '@/lib/dimensional-analysis';
```

**Step 2: Create fragments after dimensional analysis (emergent path only)**

Find the section where `analyzeDimensionalCoverage` is called (around line 270-290). After the dimensional coverage is computed, add fragment creation.

Look for code like:
```typescript
// Analyze dimensional coverage for emergent extractions
const dimensionalCoverage = await analyzeDimensionalCoverage(
  extractedContext,
  conversationHistory
);
```

After that block, add:

```typescript
// Create fragments from themes with dimension tags
if (conversation.projectId) {
  try {
    const dimensionTags = convertCoverageToDimensionTags(dimensionalCoverage);
    const fragments = await createFragmentsFromThemes(
      conversation.projectId,
      conversationId,
      extractedContext.themes,
      dimensionTags
    );
    console.log(`[Extract] Created ${fragments.length} fragments for project ${conversation.projectId}`);
  } catch (error) {
    // Log but don't fail extraction if fragment creation fails
    console.error('[Extract] Failed to create fragments:', error);
  }
}
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit src/app/api/extract/route.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat(api): create fragments from emergent themes during extraction"
```

---

## Phase 2: Synthesis Algorithm Implementation

**Goal:** Implement the synthesis algorithm to update DimensionalSynthesis records when fragments change.

---

### Task 2.1: Create Synthesis Types

**Files:**
- Create: `src/lib/synthesis/types.ts`

**Step 1: Create types file**

```typescript
/**
 * Synthesis types
 */

import { Tier1Dimension } from '@/lib/constants/dimensions'

export interface SynthesisResult {
  summary: string
  keyThemes: string[]
  keyQuotes: string[]
  gaps: string[]
  contradictions: string[]
  subdimensions: Record<string, {
    summary: string
    fragmentIds: string[]
  }> | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface FragmentForSynthesis {
  id: string
  content: string
  contentType: string
  confidence: string | null
  capturedAt: Date
}
```

**Step 2: Commit**

```bash
mkdir -p src/lib/synthesis
git add src/lib/synthesis/types.ts
git commit -m "feat(synthesis): add synthesis types"
```

---

### Task 2.2: Create Full Synthesis Function

**Files:**
- Create: `src/lib/synthesis/full-synthesis.ts`

**Step 1: Create full synthesis implementation**

```typescript
/**
 * Full synthesis - creates synthesis from all fragments
 */

import { anthropic, CLAUDE_MODEL } from '@/lib/claude'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { SynthesisResult, FragmentForSynthesis } from './types'

const FULL_SYNTHESIS_PROMPT = `You are synthesizing strategic understanding for the dimension: **{dimension}**.

You have {count} fragments captured from conversations. Your task is to synthesize these into a coherent understanding.

## Fragments:

{fragments}

## Your Task:

Synthesize these fragments into structured understanding:

1. **Summary** (2-3 paragraphs): What do we understand about {dimension}? Use the leader's authentic voice where possible.

2. **Key Themes** (3-7 themes): What are the main ideas? Each theme should be a short phrase or sentence.

3. **Key Quotes** (3-5 quotes): Verbatim quotes that capture the essence. Use exact wording from fragments.

4. **Gaps** (list): What's missing? What would deepen our understanding of {dimension}?

5. **Contradictions** (list): Are there conflicting fragments? Surface tensions, don't hide them.

6. **Subdimensions** (emergent): Are there natural groupings or sub-categories within these fragments? Only include if clearly evident.

7. **Confidence** (HIGH | MEDIUM | LOW): How comprehensive is this understanding?
   - HIGH: 5+ fragments, clear themes, few gaps
   - MEDIUM: 3-5 fragments, some gaps remain
   - LOW: <3 fragments or significant gaps

Return ONLY valid JSON (no markdown code blocks):
{
  "summary": "...",
  "keyThemes": ["...", "..."],
  "keyQuotes": ["...", "..."],
  "gaps": ["...", "..."],
  "contradictions": ["...", "..."],
  "subdimensions": null,
  "confidence": "MEDIUM"
}`

export async function fullSynthesis(
  dimension: Tier1Dimension,
  fragments: FragmentForSynthesis[]
): Promise<SynthesisResult> {
  if (fragments.length === 0) {
    return {
      summary: '',
      keyThemes: [],
      keyQuotes: [],
      gaps: [`No fragments captured yet for ${dimension}`],
      contradictions: [],
      subdimensions: null,
      confidence: 'LOW'
    }
  }

  const fragmentsText = fragments
    .map((f, i) => `### Fragment ${i + 1}\nType: ${f.contentType}\nConfidence: ${f.confidence || 'unknown'}\n\n${f.content}`)
    .join('\n\n---\n\n')

  const prompt = FULL_SYNTHESIS_PROMPT
    .replace(/{dimension}/g, dimension.replace(/_/g, ' '))
    .replace('{count}', String(fragments.length))
    .replace('{fragments}', fragmentsText)

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  })

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '{}'

  try {
    // Clean up response - remove markdown code blocks if present
    const cleanedContent = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const result = JSON.parse(cleanedContent) as SynthesisResult
    return result
  } catch (error) {
    console.error('[Synthesis] Failed to parse response:', content)
    return {
      summary: '',
      keyThemes: [],
      keyQuotes: [],
      gaps: ['Synthesis failed - could not parse LLM response'],
      contradictions: [],
      subdimensions: null,
      confidence: 'LOW'
    }
  }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/synthesis/full-synthesis.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/synthesis/full-synthesis.ts
git commit -m "feat(synthesis): implement full synthesis algorithm"
```

---

### Task 2.3: Create Incremental Synthesis Function

**Files:**
- Create: `src/lib/synthesis/incremental-synthesis.ts`

**Step 1: Create incremental synthesis implementation**

```typescript
/**
 * Incremental synthesis - merges new fragments into existing synthesis
 */

import { anthropic, CLAUDE_MODEL } from '@/lib/claude'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { SynthesisResult, FragmentForSynthesis } from './types'
import { DimensionalSynthesis } from '@prisma/client'

const INCREMENTAL_SYNTHESIS_PROMPT = `You are updating strategic understanding for the dimension: **{dimension}**.

## Existing Synthesis:

Summary:
{existingSummary}

Key Themes:
{existingThemes}

Gaps:
{existingGaps}

Confidence: {existingConfidence}

---

## New Fragments:

{newFragments}

## Your Task:

These new fragments have been added since the last synthesis. Update the existing synthesis by:

1. **Enriching the summary** with new insights (don't rewrite, just enhance)
2. **Adding new themes** if distinct from existing
3. **Adding new quotes** that capture important ideas
4. **Updating gaps** (remove gaps that are now filled, add new gaps discovered)
5. **Surfacing contradictions** if new fragments conflict with existing understanding
6. **Re-assessing confidence** based on new information

Return ONLY valid JSON with UPDATED synthesis (not just deltas):
{
  "summary": "... (updated) ...",
  "keyThemes": ["... (existing + new) ..."],
  "keyQuotes": ["... (existing + new) ..."],
  "gaps": ["... (updated) ..."],
  "contradictions": ["..."],
  "subdimensions": null,
  "confidence": "HIGH"
}`

export async function incrementalSynthesis(
  dimension: Tier1Dimension,
  existingSynthesis: DimensionalSynthesis,
  newFragments: FragmentForSynthesis[]
): Promise<SynthesisResult> {
  if (newFragments.length === 0) {
    return {
      summary: existingSynthesis.summary || '',
      keyThemes: existingSynthesis.keyThemes,
      keyQuotes: existingSynthesis.keyQuotes,
      gaps: existingSynthesis.gaps,
      contradictions: existingSynthesis.contradictions,
      subdimensions: existingSynthesis.subdimensions as any,
      confidence: existingSynthesis.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
    }
  }

  const newFragmentsText = newFragments
    .map((f, i) => `### Fragment ${i + 1}\n${f.content}`)
    .join('\n\n---\n\n')

  const prompt = INCREMENTAL_SYNTHESIS_PROMPT
    .replace(/{dimension}/g, dimension.replace(/_/g, ' '))
    .replace('{existingSummary}', existingSynthesis.summary || 'No summary yet')
    .replace('{existingThemes}', existingSynthesis.keyThemes.map(t => `- ${t}`).join('\n') || 'None')
    .replace('{existingGaps}', existingSynthesis.gaps.map(g => `- ${g}`).join('\n') || 'None identified')
    .replace('{existingConfidence}', existingSynthesis.confidence)
    .replace('{newFragments}', newFragmentsText)

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  })

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '{}'

  try {
    const cleanedContent = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const result = JSON.parse(cleanedContent) as SynthesisResult
    return result
  } catch (error) {
    console.error('[Synthesis] Failed to parse incremental response:', content)
    // Return existing synthesis unchanged on error
    return {
      summary: existingSynthesis.summary || '',
      keyThemes: existingSynthesis.keyThemes,
      keyQuotes: existingSynthesis.keyQuotes,
      gaps: existingSynthesis.gaps,
      contradictions: existingSynthesis.contradictions,
      subdimensions: existingSynthesis.subdimensions as any,
      confidence: existingSynthesis.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
    }
  }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/synthesis/incremental-synthesis.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/synthesis/incremental-synthesis.ts
git commit -m "feat(synthesis): implement incremental synthesis algorithm"
```

---

### Task 2.4: Create Update Synthesis Orchestrator

**Files:**
- Create: `src/lib/synthesis/update-synthesis.ts`

**Step 1: Create the orchestrator that decides full vs incremental**

```typescript
/**
 * Update synthesis - orchestrates full vs incremental synthesis
 */

import { prisma } from '@/lib/db'
import { Tier1Dimension } from '@/lib/constants/dimensions'
import { fullSynthesis } from './full-synthesis'
import { incrementalSynthesis } from './incremental-synthesis'
import { FragmentForSynthesis } from './types'

/**
 * Determine if we should do full synthesis or incremental
 */
function shouldFullSynthesis(
  existingSynthesis: { summary: string | null; lastSynthesizedAt: Date; fragmentCount: number },
  allFragmentsCount: number,
  newFragmentsCount: number
): boolean {
  // 1. No existing synthesis
  if (!existingSynthesis.summary) return true

  // 2. Synthesis is stale (> 30 days old)
  const daysSinceLastSynthesis =
    (Date.now() - existingSynthesis.lastSynthesizedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastSynthesis > 30) return true

  // 3. Fragments changed significantly (> 50% new)
  if (allFragmentsCount > 0 && newFragmentsCount / allFragmentsCount > 0.5) return true

  // 4. Very few fragments (< 5) - full synthesis is cheap
  if (allFragmentsCount < 5) return true

  // Otherwise, use incremental
  return false
}

/**
 * Update synthesis for a specific dimension
 */
export async function updateDimensionalSynthesis(
  projectId: string,
  dimension: Tier1Dimension
): Promise<void> {
  console.log(`[Synthesis] Updating ${dimension} for project ${projectId}`)

  // 1. Get existing synthesis
  const existingSynthesis = await prisma.dimensionalSynthesis.findUnique({
    where: {
      projectId_dimension: { projectId, dimension }
    }
  })

  if (!existingSynthesis) {
    console.error(`[Synthesis] No synthesis record found for ${dimension}`)
    return
  }

  // 2. Get all active fragments for this dimension
  const allFragments = await prisma.fragment.findMany({
    where: {
      projectId,
      status: 'active',
      dimensionTags: {
        some: { dimension }
      }
    },
    select: {
      id: true,
      content: true,
      contentType: true,
      confidence: true,
      capturedAt: true
    },
    orderBy: { capturedAt: 'asc' }
  })

  console.log(`[Synthesis] Found ${allFragments.length} fragments for ${dimension}`)

  if (allFragments.length === 0) {
    // No fragments - update to empty state
    await prisma.dimensionalSynthesis.update({
      where: { id: existingSynthesis.id },
      data: {
        summary: null,
        keyThemes: [],
        keyQuotes: [],
        gaps: [],
        contradictions: [],
        subdimensions: null,
        confidence: 'LOW',
        fragmentCount: 0,
        lastSynthesizedAt: new Date(),
        synthesizedBy: 'claude-synthesis'
      }
    })
    return
  }

  // 3. Get new fragments (created after last synthesis)
  const newFragments = allFragments.filter(
    f => f.capturedAt > existingSynthesis.lastSynthesizedAt
  )

  // 4. Decide: full or incremental?
  const useFullSynthesis = shouldFullSynthesis(
    existingSynthesis,
    allFragments.length,
    newFragments.length
  )

  console.log(`[Synthesis] Using ${useFullSynthesis ? 'FULL' : 'INCREMENTAL'} synthesis (${newFragments.length} new fragments)`)

  // 5. Run synthesis
  const fragmentsForSynthesis: FragmentForSynthesis[] = useFullSynthesis
    ? allFragments
    : newFragments

  const result = useFullSynthesis
    ? await fullSynthesis(dimension, fragmentsForSynthesis)
    : await incrementalSynthesis(dimension, existingSynthesis, fragmentsForSynthesis)

  // 6. Save result
  await prisma.dimensionalSynthesis.update({
    where: { id: existingSynthesis.id },
    data: {
      summary: result.summary || null,
      keyThemes: result.keyThemes,
      keyQuotes: result.keyQuotes,
      gaps: result.gaps,
      contradictions: result.contradictions,
      subdimensions: result.subdimensions,
      confidence: result.confidence,
      fragmentCount: allFragments.length,
      lastSynthesizedAt: new Date(),
      synthesizedBy: 'claude-synthesis'
    }
  })

  console.log(`[Synthesis] Updated ${dimension} with confidence ${result.confidence}`)
}

/**
 * Update all syntheses that have new fragments
 */
export async function updateAllSyntheses(projectId: string): Promise<void> {
  // Get all dimensions that have fragments
  const dimensionsWithFragments = await prisma.fragmentDimensionTag.findMany({
    where: {
      fragment: {
        projectId,
        status: 'active'
      }
    },
    select: {
      dimension: true
    },
    distinct: ['dimension']
  })

  const dimensions = dimensionsWithFragments.map(d => d.dimension as Tier1Dimension)

  console.log(`[Synthesis] Updating ${dimensions.length} dimensions for project ${projectId}`)

  for (const dimension of dimensions) {
    await updateDimensionalSynthesis(projectId, dimension)
  }
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/synthesis/update-synthesis.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/synthesis/update-synthesis.ts
git commit -m "feat(synthesis): add synthesis update orchestrator"
```

---

### Task 2.5: Create Synthesis Index Export

**Files:**
- Create: `src/lib/synthesis/index.ts`

**Step 1: Create index file**

```typescript
/**
 * Synthesis module exports
 */

export * from './types'
export * from './full-synthesis'
export * from './incremental-synthesis'
export * from './update-synthesis'
```

**Step 2: Commit**

```bash
git add src/lib/synthesis/index.ts
git commit -m "feat(synthesis): add module exports"
```

---

### Task 2.6: Trigger Synthesis After Fragment Creation

**Files:**
- Modify: `src/app/api/extract/route.ts`

**Step 1: Add synthesis import**

At top of file, add:

```typescript
import { updateAllSyntheses } from '@/lib/synthesis';
```

**Step 2: Trigger synthesis after fragment creation**

Find the fragment creation block added in Task 1.3 and add synthesis trigger:

```typescript
// Create fragments from themes with dimension tags
if (conversation.projectId) {
  try {
    const dimensionTags = convertCoverageToDimensionTags(dimensionalCoverage);
    const fragments = await createFragmentsFromThemes(
      conversation.projectId,
      conversationId,
      extractedContext.themes,
      dimensionTags
    );
    console.log(`[Extract] Created ${fragments.length} fragments for project ${conversation.projectId}`);

    // Trigger synthesis update (async, don't block response)
    updateAllSyntheses(conversation.projectId).catch(error => {
      console.error('[Extract] Failed to update syntheses:', error);
    });
  } catch (error) {
    console.error('[Extract] Failed to create fragments:', error);
  }
}
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit src/app/api/extract/route.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat(api): trigger synthesis update after fragment creation"
```

---

## Phase 3: GeneratedOutput and ExtractionRun

**Goal:** Update the generate route to create GeneratedOutput and ExtractionRun records for evaluation tracking.

---

### Task 3.1: Create ExtractionRun Service

**Files:**
- Create: `src/lib/extraction-runs.ts`

**Step 1: Create extraction run service**

```typescript
/**
 * ExtractionRun service - tracks extraction+generation runs for evaluation
 */

import { prisma } from '@/lib/db'

export interface CreateExtractionRunInput {
  projectId: string
  conversationId: string
  experimentVariant?: string
  fragmentIds: string[]
  modelUsed: string
  promptTokens?: number
  completionTokens?: number
  latencyMs?: number
  generatedOutputId?: string
}

/**
 * Create an extraction run record
 */
export async function createExtractionRun(input: CreateExtractionRunInput) {
  // Capture synthesis state before (for A/B evaluation)
  const synthesesBefore = await prisma.dimensionalSynthesis.findMany({
    where: { projectId: input.projectId },
    select: {
      dimension: true,
      summary: true,
      confidence: true,
      fragmentCount: true
    }
  })

  const run = await prisma.extractionRun.create({
    data: {
      projectId: input.projectId,
      conversationId: input.conversationId,
      experimentVariant: input.experimentVariant,
      fragmentIds: input.fragmentIds,
      synthesesBefore: synthesesBefore,
      modelUsed: input.modelUsed,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      latencyMs: input.latencyMs,
      generatedOutputId: input.generatedOutputId
    }
  })

  return run
}

/**
 * Update extraction run with synthesis results (after synthesis completes)
 */
export async function updateExtractionRunWithSyntheses(
  runId: string,
  projectId: string
) {
  const synthesesAfter = await prisma.dimensionalSynthesis.findMany({
    where: { projectId },
    select: {
      dimension: true,
      summary: true,
      confidence: true,
      fragmentCount: true
    }
  })

  await prisma.extractionRun.update({
    where: { id: runId },
    data: { synthesesAfter }
  })
}
```

**Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/extraction-runs.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/extraction-runs.ts
git commit -m "feat(lib): add extraction run service for evaluation tracking"
```

---

### Task 3.2: Update Generate Route to Create GeneratedOutput

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Step 1: Add import**

At top of file, add:

```typescript
import { createExtractionRun, updateExtractionRunWithSyntheses } from '@/lib/extraction-runs';
```

**Step 2: Create GeneratedOutput after generation**

Find where the trace is created (around line 209-224). After the trace creation, add GeneratedOutput and ExtractionRun creation:

```typescript
// Save trace (legacy - keeping for backward compatibility)
console.log('[Generate API] Saving trace to database...');
const trace = await prisma.trace.create({
  data: {
    conversationId,
    userId: conversation.userId,
    extractedContext: extractedContext as any,
    dimensionalCoverage: dimensionalCoverage as any,
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

// Create GeneratedOutput (new schema)
let generatedOutput = null;
let extractionRun = null;

if (conversation.projectId) {
  try {
    generatedOutput = await prisma.generatedOutput.create({
      data: {
        projectId: conversation.projectId,
        userId: conversation.userId,
        outputType: 'full_decision_stack',
        version: 1,
        content: statements as any,
        modelUsed: CLAUDE_MODEL,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
      }
    });
    console.log('[Generate API] GeneratedOutput saved with ID:', generatedOutput.id);

    // Get fragment IDs from this conversation
    const fragments = await prisma.fragment.findMany({
      where: { conversationId },
      select: { id: true }
    });
    const fragmentIds = fragments.map(f => f.id);

    // Create ExtractionRun for evaluation
    extractionRun = await createExtractionRun({
      projectId: conversation.projectId,
      conversationId,
      experimentVariant: conversation.experimentVariant || undefined,
      fragmentIds,
      modelUsed: CLAUDE_MODEL,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs: latency,
      generatedOutputId: generatedOutput.id
    });
    console.log('[Generate API] ExtractionRun saved with ID:', extractionRun.id);

    // Update with syntheses after (async)
    updateExtractionRunWithSyntheses(extractionRun.id, conversation.projectId).catch(err => {
      console.error('[Generate API] Failed to update extraction run with syntheses:', err);
    });
  } catch (error) {
    console.error('[Generate API] Failed to create GeneratedOutput/ExtractionRun:', error);
    // Continue - don't fail generation if new schema writes fail
  }
}
```

**Step 3: Verify file compiles**

Run: `npx tsc --noEmit src/app/api/generate/route.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat(api): create GeneratedOutput and ExtractionRun during generation"
```

---

## Phase 4: Integration Testing

**Goal:** Verify the full flow works end-to-end.

---

### Task 4.1: Create Integration Test Script

**Files:**
- Create: `scripts/test-fragment-flow.ts`

**Step 1: Create test script**

```typescript
#!/usr/bin/env tsx
/**
 * Integration test: Fragment extraction and synthesis flow
 *
 * This script simulates the extraction flow to verify fragments are created
 * and synthesis is triggered.
 */

import { prisma } from '@/lib/db'
import { createFragmentsFromThemes } from '@/lib/fragments'
import { updateAllSyntheses } from '@/lib/synthesis'
import { TIER_1_DIMENSIONS } from '@/lib/constants/dimensions'

async function main() {
  console.log('=== Fragment Flow Integration Test ===\n')

  // 1. Get a project
  const project = await prisma.project.findFirst()
  if (!project) {
    console.error('No project found. Run migration scripts first.')
    process.exit(1)
  }
  console.log(`Using project: ${project.id} (${project.name})`)

  // 2. Get a conversation
  const conversation = await prisma.conversation.findFirst({
    where: { projectId: project.id }
  })
  if (!conversation) {
    console.error('No conversation found for project.')
    process.exit(1)
  }
  console.log(`Using conversation: ${conversation.id}`)

  // 3. Create test fragments
  console.log('\n--- Creating Test Fragments ---')
  const testThemes = [
    {
      theme_name: 'Customer Pain Points',
      content: 'Enterprise customers struggle with data integration across multiple SaaS tools. They spend hours manually moving data between systems.'
    },
    {
      theme_name: 'Market Opportunity',
      content: 'The integration market is growing at 25% annually. Most solutions are too technical for non-developers.'
    }
  ]

  const dimensionMappings = new Map([
    ['Customer Pain Points', [{ dimension: 'CUSTOMER_MARKET' as const, confidence: 'HIGH' as const }]],
    ['Market Opportunity', [{ dimension: 'PROBLEM_OPPORTUNITY' as const, confidence: 'MEDIUM' as const }]]
  ])

  const fragments = await createFragmentsFromThemes(
    project.id,
    conversation.id,
    testThemes,
    dimensionMappings
  )
  console.log(`Created ${fragments.length} fragments`)
  fragments.forEach(f => {
    console.log(`  - ${f.id}: ${f.dimensionTags.length} dimension tags`)
  })

  // 4. Run synthesis
  console.log('\n--- Running Synthesis ---')
  await updateAllSyntheses(project.id)

  // 5. Check results
  console.log('\n--- Checking Results ---')
  const syntheses = await prisma.dimensionalSynthesis.findMany({
    where: {
      projectId: project.id,
      fragmentCount: { gt: 0 }
    }
  })

  console.log(`Syntheses with fragments: ${syntheses.length}`)
  for (const s of syntheses) {
    console.log(`  - ${s.dimension}: ${s.fragmentCount} fragments, confidence=${s.confidence}`)
    if (s.summary) {
      console.log(`    Summary: ${s.summary.substring(0, 100)}...`)
    }
  }

  // 6. Verify fragment counts
  const fragmentCount = await prisma.fragment.count({
    where: { projectId: project.id }
  })
  const tagCount = await prisma.fragmentDimensionTag.count()

  console.log(`\n--- Summary ---`)
  console.log(`Fragments: ${fragmentCount}`)
  console.log(`Dimension Tags: ${tagCount}`)
  console.log(`Syntheses updated: ${syntheses.length}`)

  console.log('\n✅ Integration test complete!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Step 2: Run test**

Run: `npx tsx scripts/test-fragment-flow.ts`
Expected: Fragments created, synthesis updated, no errors

**Step 3: Commit**

```bash
git add scripts/test-fragment-flow.ts
git commit -m "test: add fragment flow integration test script"
```

---

### Task 4.2: Update Verification Script

**Files:**
- Modify: `scripts/migrations/verify-migration.ts`

**Step 1: Add fragment and synthesis checks**

Add new checks after the existing ones:

```typescript
// Check 5: Fragments exist
console.log('\nCheck 5: Fragments created')
const fragmentCount = await prisma.fragment.count()
const tagCount = await prisma.fragmentDimensionTag.count()
console.log(`  ℹ  INFO: ${fragmentCount} fragments, ${tagCount} dimension tags`)

// Check 6: Syntheses have been updated
console.log('\nCheck 6: Syntheses updated')
const updatedSyntheses = await prisma.dimensionalSynthesis.count({
  where: { fragmentCount: { gt: 0 } }
})
console.log(`  ℹ  INFO: ${updatedSyntheses} syntheses have fragments`)

// Check 7: GeneratedOutputs exist
console.log('\nCheck 7: GeneratedOutputs created')
const outputCount = await prisma.generatedOutput.count()
console.log(`  ℹ  INFO: ${outputCount} generated outputs`)

// Check 8: ExtractionRuns exist
console.log('\nCheck 8: ExtractionRuns created')
const runCount = await prisma.extractionRun.count()
console.log(`  ℹ  INFO: ${runCount} extraction runs`)
```

**Step 2: Update summary section**

```typescript
// Summary
console.log('\n=== Summary ===')
const totalProjects = await prisma.project.count()
const totalConversations = await prisma.conversation.count()
const totalFragments = await prisma.fragment.count()
const totalSyntheses = await prisma.dimensionalSynthesis.count()
const totalOutputs = await prisma.generatedOutput.count()
const totalRuns = await prisma.extractionRun.count()

console.log(`Projects: ${totalProjects}`)
console.log(`Conversations: ${totalConversations}`)
console.log(`Fragments: ${totalFragments}`)
console.log(`Syntheses: ${totalSyntheses} (${updatedSyntheses} with fragments)`)
console.log(`GeneratedOutputs: ${totalOutputs}`)
console.log(`ExtractionRuns: ${totalRuns}`)
```

**Step 3: Commit**

```bash
git add scripts/migrations/verify-migration.ts
git commit -m "test: add fragment and synthesis checks to verification script"
```

---

## Phase 5: Final Verification and Documentation

---

### Task 5.1: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run verification script**

Run: `npx tsx scripts/migrations/verify-migration.ts`
Expected: All checks pass

---

### Task 5.2: Update Architecture Documentation

**Files:**
- Modify: `.claude/architecture.md`

**Step 1: Add extraction flow documentation**

Add to the "Database Schema V1" section:

```markdown
### Extraction → Fragment → Synthesis Flow

1. **Extraction** (`/api/extract`) extracts emergent themes from conversation
2. **Fragment Creation** creates Fragment records with dimension tags
3. **Synthesis Update** runs full or incremental synthesis per dimension
4. **Generation** (`/api/generate`) creates GeneratedOutput + ExtractionRun

### Key Files

- `src/lib/fragments.ts` - Fragment creation service
- `src/lib/synthesis/` - Synthesis algorithm implementation
- `src/lib/extraction-runs.ts` - ExtractionRun tracking
- `src/lib/dimensional-analysis.ts` - Maps themes to dimensions
```

**Step 2: Commit**

```bash
git add .claude/architecture.md
git commit -m "docs: update architecture with fragment/synthesis flow"
```

---

### Task 5.3: Final Commit

**Step 1: Commit all changes**

```bash
git add .
git commit -m "feat: complete fragment extraction and synthesis implementation

- Add Fragment creation from emergent themes
- Add dimension tagging via dimensional analysis
- Implement full and incremental synthesis algorithms
- Add GeneratedOutput and ExtractionRun tracking
- Add integration test and verification checks"
```

---

## Success Criteria

Migration is complete when:

- [ ] Fragments created from emergent themes during extraction
- [ ] FragmentDimensionTags created with dimension mappings
- [ ] DimensionalSynthesis updated after fragment creation
- [ ] GeneratedOutput created during generation
- [ ] ExtractionRun created with fragment IDs and synthesis snapshots
- [ ] All existing tests pass
- [ ] Verification script shows fragments and syntheses populated
- [ ] No TypeScript errors

---

## Rollback

If issues occur:

1. Fragment creation is wrapped in try/catch - won't break extraction
2. Synthesis runs async - won't block responses
3. GeneratedOutput/ExtractionRun creation won't break generation if it fails
4. Legacy Trace model continues to work unchanged

To fully rollback:
1. Revert commits
2. Tables will have data but app won't write to them
