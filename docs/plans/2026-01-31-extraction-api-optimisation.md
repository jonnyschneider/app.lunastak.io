# Extraction API Optimisation Plan

**Date:** 2026-01-31
**Status:** Ready for Implementation
**Author:** Claude (with Jonny)

## Summary

Reduce extraction-to-strategy time from ~30-60s to ~10-18s by:
1. Removing reflective_summary from critical path (generate works with themes only)
2. Skipping ExtractionConfirm step (go straight to generation)
3. Moving synthesis/knowledge to background via `waitUntil`
4. Introducing prompt registry for versioning and future experimentation

## Architecture

### Production Flow (TO-BE)

```
/api/extract                          /api/generate
┌─────────────────────┐              ┌─────────────────────┐
│ Theme Extraction    │              │ Strategy Generation │
│ (~3-8s)             │───────────►  │ (~5-10s)            │
│                     │   themes     │                     │
│ Create Fragments    │   only       │ Vision/Strategy/Obj │
└─────────┬───────────┘              └─────────────────────┘
          │
          │ waitUntil (background)
          ▼
┌─────────────────────┐
│ - Reflective Summary│  → Luna's Thinking tab
│ - Update Syntheses  │  → Dimensional synthesis
│ - Knowledge Summary │  → Your Thinking page
└─────────────────────┘
```

### Prompt Registry Pattern

```
src/lib/prompts/
├── index.ts                      # Registry + getCurrentPrompt()
├── extraction/
│   └── v1-emergent.ts           # Theme extraction (current)
├── generation/
│   ├── v1-with-summary.ts       # Original (deprecated)
│   └── v2-themes-only.ts        # New (current)
└── reflective-summary/
    └── v1.ts                    # For background + backtest
```

### Backtest Architecture

```
scripts/
├── backtest.ts                  # Replay traces through prompt versions
└── eval-report.ts               # Generate comparison report

Backtest is independent of API routes:
  Traces (DB) → Prompt versions (lib) → Claude → Eval results (flat/DB)
```

---

## Implementation Tasks

### Phase 1: Prompt Registry

#### Task 1.1: Create prompt registry structure

**Files to create:**

```
src/lib/prompts/index.ts
src/lib/prompts/types.ts
src/lib/prompts/extraction/v1-emergent.ts
src/lib/prompts/generation/v1-with-summary.ts
src/lib/prompts/generation/v2-themes-only.ts
src/lib/prompts/reflective-summary/v1.ts
```

**`src/lib/prompts/types.ts`:**
```typescript
export interface PromptVersion {
  id: string
  template: string
  description: string
  current: boolean
  deprecated?: boolean
  deprecatedAt?: string
  createdAt: string
}

export type PromptType = 'extraction' | 'generation' | 'reflective-summary'
```

**`src/lib/prompts/index.ts`:**
```typescript
import { PromptVersion, PromptType } from './types'
import { EMERGENT_EXTRACTION_V1 } from './extraction/v1-emergent'
import { GENERATION_WITH_SUMMARY_V1 } from './generation/v1-with-summary'
import { GENERATION_THEMES_ONLY_V2 } from './generation/v2-themes-only'
import { REFLECTIVE_SUMMARY_V1 } from './reflective-summary/v1'

export const PROMPT_REGISTRY: Record<PromptType, Record<string, PromptVersion>> = {
  extraction: {
    'v1-emergent': EMERGENT_EXTRACTION_V1,
  },
  generation: {
    'v1-with-summary': GENERATION_WITH_SUMMARY_V1,
    'v2-themes-only': GENERATION_THEMES_ONLY_V2,
  },
  'reflective-summary': {
    'v1': REFLECTIVE_SUMMARY_V1,
  },
}

export function getCurrentPrompt(type: PromptType): PromptVersion {
  const versions = PROMPT_REGISTRY[type]
  const current = Object.values(versions).find(v => v.current)
  if (!current) throw new Error(`No current prompt for ${type}`)
  return current
}

export function getPrompt(type: PromptType, versionId: string): PromptVersion | undefined {
  return PROMPT_REGISTRY[type][versionId]
}

export function listPromptVersions(type: PromptType): PromptVersion[] {
  return Object.values(PROMPT_REGISTRY[type])
}
```

**Verification:**
```bash
npm run type-check
```

---

#### Task 1.2: Extract existing prompts into registry

Move prompts from route files to registry modules.

**`src/lib/prompts/extraction/v1-emergent.ts`:**
```typescript
import { PromptVersion } from '../types'

export const EMERGENT_EXTRACTION_V1: PromptVersion = {
  id: 'v1-emergent',
  description: 'Theme extraction with inline dimension tagging',
  current: true,
  createdAt: '2025-01-01',
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

Format your extraction:

<extraction>
  <theme>
    <theme_name>Name that describes this theme</theme_name>
    <content>Detailed summary of what was discussed about this theme</content>
    <dimensions>
      <dimension name="dimension_key" confidence="high|medium|low"/>
    </dimensions>
  </theme>
</extraction>`,
}
```

**`src/lib/prompts/generation/v2-themes-only.ts`:**
```typescript
import { PromptVersion } from '../types'

export const GENERATION_THEMES_ONLY_V2: PromptVersion = {
  id: 'v2-themes-only',
  description: 'Strategy generation from themes only - no reflective summary dependency',
  current: true,
  createdAt: '2026-01-31',
  template: `Generate compelling strategy statements based on the emergent themes from our conversation.

EMERGENT THEMES:
{themes}

Your task:
1. Analyze these themes to identify what's strong, what's emerging, and what needs exploration
2. Generate a cohesive strategy that builds on these themes

Guidelines:
- Use the emergent themes as your foundation - these represent what actually matters to this business
- Vision: Should be aspirational, future-focused, and memorable
- Strategy: Should be clear, actionable, and focused on current purpose
- Objectives: Should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Use their language and themes - make it feel authentic to their business, not generic corporate speak

Format your response as:
<thoughts>Your analysis of the themes - what's strong, what's emerging, what needs exploration. Reference specific themes.</thoughts>
<statements>
  <vision>The vision statement</vision>
  <strategy>The strategy statement</strategy>
  <objectives>
  1. First objective
  2. Second objective
  3. Third objective
  </objectives>
</statements>`,
}
```

**Verification:**
- Prompts extracted correctly
- Types compile
- Registry exports work

---

### Phase 2: Contract Updates

#### Task 2.1: Update extraction contract to make reflective_summary optional

**File:** `src/lib/contracts/extraction.ts`

```typescript
// Emergent extraction output - reflective_summary now optional (background)
export interface EmergentExtractionContract {
  themes: EmergentThemeContract[];
  reflective_summary?: ReflectiveSummaryContract;  // Optional - populated by background
  extraction_approach: 'emergent';
}

// Update validation to accept missing reflective_summary
export function validateEmergentExtraction(data: unknown): data is EmergentExtractionContract {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (obj.extraction_approach !== 'emergent') return false;
  if (!Array.isArray(obj.themes)) return false;
  if (obj.themes.length === 0) return false;

  // Check first theme has required fields
  const theme = obj.themes[0] as Record<string, unknown>;
  if (typeof theme.theme_name !== 'string' || !theme.theme_name) return false;
  if (typeof theme.content !== 'string' || !theme.content) return false;

  // reflective_summary is optional, but if present must be valid
  if (obj.reflective_summary !== undefined) {
    const summary = obj.reflective_summary as Record<string, unknown>;
    if (typeof summary !== 'object' || summary === null) return false;
    if (!Array.isArray(summary.strengths)) return false;
    if (!Array.isArray(summary.emerging)) return false;
    if (!Array.isArray(summary.opportunities_for_enrichment)) return false;
  }

  return true;
}
```

#### Task 2.2: Update contract tests

**File:** `src/lib/__tests__/contracts/extraction-contracts.test.ts`

Add tests for optional reflective_summary:

```typescript
it('should validate extraction without reflective_summary (immediate output)', () => {
  const { reflective_summary, ...immediateOutput } = validEmergent;
  expect(validateEmergentExtraction(immediateOutput)).toBe(true);
});

it('should validate extraction with reflective_summary (full output)', () => {
  expect(validateEmergentExtraction(validEmergent)).toBe(true);
});

it('should reject extraction with invalid reflective_summary structure', () => {
  const invalid = {
    ...validEmergent,
    reflective_summary: { invalid: 'structure' },
  };
  expect(validateEmergentExtraction(invalid)).toBe(false);
});
```

**Verification:**
```bash
npm test -- --testPathPattern=contracts
```

---

### Phase 3: Background Task Infrastructure

#### Task 3.1: Create background task runner

**File:** `src/lib/background-tasks.ts` (NEW)

```typescript
import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/db'

export type BackgroundTaskStatus = 'IDLE' | 'PROCESSING' | 'COMPLETE' | 'ERROR'

interface BackgroundTask {
  name: string
  fn: () => Promise<void>
}

interface BackgroundTaskOptions {
  projectId: string
  tasks: BackgroundTask[]
}

/**
 * Run tasks in background after response is sent.
 * Uses Vercel's waitUntil to detach from request lifecycle.
 */
export function runBackgroundTasks({ projectId, tasks }: BackgroundTaskOptions) {
  waitUntil(executeBackgroundTasks(projectId, tasks))
}

async function executeBackgroundTasks(projectId: string, tasks: BackgroundTask[]) {
  console.log(`[Background] Starting ${tasks.length} tasks for project ${projectId}`)

  const errors: string[] = []

  for (const task of tasks) {
    try {
      console.log(`[Background] Running: ${task.name}`)
      const start = Date.now()
      await task.fn()
      console.log(`[Background] Completed: ${task.name} (${Date.now() - start}ms)`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Background] Failed: ${task.name}`, error)
      errors.push(`${task.name}: ${msg}`)
    }
  }

  console.log(`[Background] All tasks finished for project ${projectId}${errors.length > 0 ? ` with ${errors.length} errors` : ''}`)
}
```

**Verification:**
- TypeScript compiles
- Can be imported from routes

---

### Phase 4: Route Refactoring

#### Task 4.1: Refactor /api/extract

**File:** `src/app/api/extract/route.ts`

Changes:
1. Import prompts from registry
2. Remove inline REFLECTIVE_SUMMARY call from blocking path
3. Send `complete` immediately after fragments created
4. Schedule background tasks via `runBackgroundTasks`

```typescript
// Key changes (pseudocode):

import { getCurrentPrompt } from '@/lib/prompts'
import { runBackgroundTasks } from '@/lib/background-tasks'

// Use prompt from registry
const extractionPrompt = getCurrentPrompt('extraction')

// After theme extraction and fragment creation...

// Send complete immediately (no reflective_summary yet)
sendProgress({
  step: 'complete',
  data: {
    extractedContext: {
      themes: extractedContext.themes,
      extraction_approach: 'emergent',
      // reflective_summary intentionally omitted - background will populate
    },
    dimensionalCoverage,
  },
})

controller.close()

// Schedule background tasks (runs after response sent)
if (conversation.projectId && !lightweight) {
  const projectId = conversation.projectId
  const convId = conversationId
  const history = conversationHistory

  runBackgroundTasks({
    projectId,
    tasks: [
      {
        name: 'generateReflectiveSummary',
        fn: async () => {
          // Generate and store reflective summary
          // Updates conversation.extractedContext or separate field
        }
      },
      {
        name: 'updateAllSyntheses',
        fn: () => updateAllSyntheses(projectId)
      },
      {
        name: 'generateKnowledgeSummary',
        fn: () => generateKnowledgeSummary(projectId)
      }
    ]
  })
}
```

#### Task 4.2: Refactor /api/generate

**File:** `src/app/api/generate/route.ts`

Changes:
1. Import prompts from registry
2. Use v2-themes-only prompt
3. Remove reflective_summary from prompt building

```typescript
import { getCurrentPrompt } from '@/lib/prompts'

// Use prompt from registry
const generationPrompt = getCurrentPrompt('generation')

// Build prompt with themes only
const themesText = context.themes
  .map(theme => `${theme.theme_name}:\n${theme.content}`)
  .join('\n\n')

const prompt = generationPrompt.template
  .replace('{themes}', themesText)
```

#### Task 4.3: Update UI flow to skip ExtractionConfirm

**File:** `src/components/chat-sheet.tsx`

Change flow from:
```
extract complete → setFlowStep('extraction') → ExtractionConfirm → handleGenerate
```

To:
```
extract complete → handleGenerate (automatic)
```

```typescript
// In extraction complete handler:
if (update.step === 'complete') {
  const { extractedContext: ctx, dimensionalCoverage: coverage } = update.data
  setExtractedContext(ctx)
  setDimensionalCoverage(coverage)

  if (isExplicitEnd) {
    toast.success('Added to your knowledge base')
    onClose()
    return
  }

  // Skip ExtractionConfirm - go straight to generation
  handleGenerate(ctx, coverage)
}
```

**Verification:**
```bash
npm run type-check
npm run test
npm run dev  # Manual testing
```

---

### Phase 5: Backtest Scaffolding

#### Task 5.1: Create evaluation types

**File:** `src/lib/evaluation/types.ts` (NEW)

```typescript
export interface EvaluationRun {
  id: string
  traceId: string
  promptType: string
  promptVersion: string
  input: {
    conversationHistory: string
    themes?: any[]
  }
  output: {
    raw: string
    parsed: any
  }
  metrics: {
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
  createdAt: Date
}

export interface BacktestConfig {
  traceIds?: string[]
  limit?: number
  promptVersions: string[]
  outputDir?: string
}

export interface ComparisonResult {
  traceId: string
  versions: Record<string, EvaluationRun>
}
```

#### Task 5.2: Create backtest script

**File:** `scripts/backtest.ts` (NEW)

```typescript
#!/usr/bin/env npx tsx

import { prisma } from '../src/lib/db'
import { getPrompt } from '../src/lib/prompts'
import { createMessage, CLAUDE_MODEL } from '../src/lib/claude'
import { BacktestConfig, EvaluationRun } from '../src/lib/evaluation/types'
import * as fs from 'fs'
import * as path from 'path'

async function backtest(config: BacktestConfig) {
  console.log('Starting backtest with config:', config)

  // 1. Fetch traces
  const traces = await prisma.trace.findMany({
    where: config.traceIds ? { id: { in: config.traceIds } } : {},
    take: config.limit || 10,
    orderBy: { timestamp: 'desc' },
    include: {
      conversation: {
        include: { messages: { orderBy: { stepNumber: 'asc' } } }
      }
    }
  })

  console.log(`Found ${traces.length} traces to process`)

  const results: EvaluationRun[] = []

  // 2. Replay each trace through each prompt version
  for (const trace of traces) {
    if (!trace.conversation) continue

    const conversationHistory = trace.conversation.messages
      .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n\n')

    for (const version of config.promptVersions) {
      const prompt = getPrompt('generation', version)
      if (!prompt) {
        console.warn(`Prompt version ${version} not found`)
        continue
      }

      console.log(`Processing trace ${trace.id} with ${version}...`)

      // Extract themes from original extractedContext
      const extractedContext = trace.extractedContext as any
      const themes = extractedContext?.themes || []
      const themesText = themes
        .map((t: any) => `${t.theme_name}:\n${t.content}`)
        .join('\n\n')

      const filledPrompt = prompt.template.replace('{themes}', themesText)

      const start = Date.now()
      const response = await createMessage({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [{ role: 'user', content: filledPrompt }],
        temperature: 0.7
      }, `backtest_${version}`)
      const latencyMs = Date.now() - start

      const rawOutput = response.content[0]?.type === 'text'
        ? response.content[0].text
        : ''

      results.push({
        id: `${trace.id}_${version}`,
        traceId: trace.id,
        promptType: 'generation',
        promptVersion: version,
        input: { conversationHistory, themes },
        output: { raw: rawOutput, parsed: null }, // Parse as needed
        metrics: {
          latencyMs,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        createdAt: new Date(),
      })
    }
  }

  // 3. Write results
  const outputDir = config.outputDir || './backtest-results'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = path.join(outputDir, `backtest-${Date.now()}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`Results written to ${outputPath}`)

  return results
}

// CLI entry point
const args = process.argv.slice(2)
const config: BacktestConfig = {
  limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5'),
  promptVersions: ['v1-with-summary', 'v2-themes-only'],
}

backtest(config)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
```

**Usage:**
```bash
npx tsx scripts/backtest.ts --limit=10
```

**Verification:**
- Script runs without errors
- Outputs valid JSON with comparison data

---

#### Task 5.3: Add trace-prompt compatibility checking

**File:** `src/lib/evaluation/compatibility.ts` (NEW)

```typescript
import { PromptVersion } from '@/lib/prompts/types'

// Schema versions track what data is guaranteed present in traces from that era
export interface TraceSchemaVersion {
  version: string
  fields: string[]
  description: string
}

export const TRACE_SCHEMA_VERSIONS: Record<string, TraceSchemaVersion> = {
  '2025-01': {
    version: '2025-01',
    description: 'Original prescriptive extraction',
    fields: [
      'extractedContext.core.industry',
      'extractedContext.core.target_market',
      'extractedContext.core.unique_value',
      'extractedContext.enrichment',
    ],
  },
  '2025-06': {
    version: '2025-06',
    description: 'Emergent extraction with themes',
    fields: [
      'extractedContext.themes',
      'extractedContext.reflective_summary',
      'extractedContext.extraction_approach',
    ],
  },
  '2026-01': {
    version: '2026-01',
    description: 'Emergent with dimensional coverage',
    fields: [
      'extractedContext.themes',
      'extractedContext.extraction_approach',
      'dimensionalCoverage',
    ],
  },
}

export function getTraceSchemaVersion(timestamp: Date): string {
  if (timestamp < new Date('2025-06-01')) return '2025-01'
  if (timestamp < new Date('2026-01-01')) return '2025-06'
  return '2026-01'
}

export interface CompatibilityResult {
  compatible: boolean
  missingFields: string[]
  traceSchemaVersion: string
}

export function checkCompatibility(
  traceTimestamp: Date,
  prompt: PromptVersion
): CompatibilityResult {
  const traceVersion = getTraceSchemaVersion(traceTimestamp)
  const traceSchema = TRACE_SCHEMA_VERSIONS[traceVersion]

  // Check minimum version requirement
  if (prompt.minTraceSchemaVersion && traceVersion < prompt.minTraceSchemaVersion) {
    return {
      compatible: false,
      missingFields: prompt.requiredInputs,
      traceSchemaVersion: traceVersion,
    }
  }

  // Check required fields
  const missingFields = (prompt.requiredInputs || []).filter(required => {
    return !traceSchema.fields.some(f => f.includes(required))
  })

  return {
    compatible: missingFields.length === 0,
    missingFields,
    traceSchemaVersion: traceVersion,
  }
}
```

**Update `src/lib/prompts/types.ts`:**

```typescript
export interface PromptVersion {
  id: string
  template: string
  description: string
  current: boolean
  deprecated?: boolean
  deprecatedAt?: string
  createdAt: string

  // Input requirements for compatibility checking
  requiredInputs: string[]
  optionalInputs?: string[]
  minTraceSchemaVersion?: string
}
```

**Update prompt definitions with requirements:**

```typescript
// v1-with-summary
requiredInputs: ['themes', 'reflective_summary'],
minTraceSchemaVersion: '2025-06',

// v2-themes-only
requiredInputs: ['themes'],
minTraceSchemaVersion: '2025-06',
```

**Update backtest.ts to use compatibility checking:**

```typescript
import { checkCompatibility } from '../src/lib/evaluation/compatibility'

// In backtest loop:
const { compatible, missingFields, traceSchemaVersion } = checkCompatibility(
  trace.timestamp,
  prompt
)

if (!compatible) {
  console.warn(`Skipping trace ${trace.id} (schema ${traceSchemaVersion}) for ${version}: missing ${missingFields.join(', ')}`)
  skippedResults.push({
    traceId: trace.id,
    promptVersion: version,
    status: 'skipped',
    reason: `Incompatible schema ${traceSchemaVersion}: missing ${missingFields.join(', ')}`,
  })
  continue
}
```

**Backtest output includes compatibility summary:**

```typescript
const output = {
  config,
  summary: {
    totalTraces: traces.length,
    byPromptVersion: Object.fromEntries(
      config.promptVersions.map(v => [v, {
        compatible: results.filter(r => r.promptVersion === v).length,
        skipped: skippedResults.filter(r => r.promptVersion === v).length,
      }])
    ),
    bySchemaVersion: Object.fromEntries(
      Object.keys(TRACE_SCHEMA_VERSIONS).map(sv => [sv,
        traces.filter(t => getTraceSchemaVersion(t.timestamp) === sv).length
      ])
    ),
  },
  runs: results,
  skipped: skippedResults,
}
```

**Verification:**
- Old traces correctly identified as incompatible with new prompts
- Compatibility summary accurate in output
- No runtime errors from missing data

---

## Testing Checklist

### Contract Tests
- [ ] Extraction without reflective_summary validates
- [ ] Extraction with reflective_summary still validates
- [ ] Invalid reflective_summary structure rejected

### Integration Tests
- [ ] /api/extract returns in <10s
- [ ] /api/generate works with themes-only input
- [ ] Background tasks execute after response sent
- [ ] UI flows from extract to generate without confirmation

### Manual Tests
- [ ] Complete conversation → strategy generates
- [ ] Luna's Thinking tab populates (after background)
- [ ] Dimensional synthesis populates (after background)
- [ ] Knowledge summary populates (after background)

### Backtest
- [ ] Script runs against production traces
- [ ] Comparison data generated for v1 vs v2

---

## Rollback Plan

1. Revert prompt registry to use v1-with-summary as current
2. Restore blocking reflective_summary call in /api/extract
3. Restore ExtractionConfirm flow in chat-sheet.tsx

The modular architecture makes rollback straightforward - just change which prompt version is marked `current: true`.

---

## R&D Documentation

This change supports the following R&D activities:
- **Prompt engineering experiments** via versioned registry
- **A/B testing** via Statsig flags selecting prompt versions
- **Backtesting** via trace replay scripts
- **Quality evaluation** via comparison reports

All experimental data is traceable and reproducible.
