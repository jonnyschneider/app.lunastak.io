# Experiment 2: Dimensional Coverage Tracking - Implementation Plan

**Date:** 2026-01-03
**Status:** Ready for Implementation
**Experiment:** E2 - Dimensional Coverage Tracking
**Related:**
- `docs/plans/strategic/2026-01-03-e1a-enhancement-briefing.md` - Context and briefing
- `docs/plans/2026-01-03-e2-deployment-strategy.md` - Git branching and deployment strategy

---

## Overview

Add dimensional coverage tracking to Experiment 1 (emergent extraction) without changing user experience. This enhancement maps emergent themes to Tier 1 strategic dimensions, enabling:
- Coverage validation (are emergent themes covering strategic dimensions?)
- Gap identification (which dimensions are systematically missed?)
- Training data for LLM-as-judge evaluation
- Future proactive questioning based on gaps

---

## Implementation Approach

**Option Selected:** Post-extraction analysis (Option A from briefing)

**Rationale:**
- Clean separation of concerns (extraction stays pure)
- No risk to emergent theme quality
- Can run asynchronously (user doesn't wait)
- Easier to iterate and improve dimensional analysis independently

---

## Architecture

### 1. Data Flow

```
User completes conversation
    ↓
Emergent extraction runs (existing)
    ↓
User sees extraction UI (existing)
    ↓
[NEW] Dimensional analysis triggered (async, after extraction)
    ↓
[NEW] Dimensional coverage stored in Trace
    ↓
[NEW] Available for Jupyter analysis
```

### 2. Components to Add/Modify

| Component | Type | Purpose |
|-----------|------|---------|
| `src/lib/dimensional-analysis.ts` | NEW | Core dimensional tagging logic |
| `src/app/api/extract/route.ts` | MODIFY | Trigger dimensional analysis |
| `src/lib/types.ts` | MODIFY | Add dimensional coverage types |
| `prisma/schema.prisma` | MODIFY | Add dimensionalCoverage field to Trace |
| `src/app/api/trace/[traceId]/route.ts` | MODIFY | Return dimensional coverage in trace queries |

---

## Detailed Implementation

### Step 1: Type Definitions

**File:** `src/lib/types.ts`

**Add:**

```typescript
// Strategic Dimensions
export const STRATEGIC_DIMENSIONS = [
  'customer_and_market',
  'problem_and_opportunity',
  'value_proposition',
  'differentiation_and_advantage',
  'competitive_landscape',
  'business_model_and_economics',
  'go_to_market',
  'product_experience',
  'capabilities_and_assets',
  'risks_and_constraints',
] as const;

export type StrategicDimension = typeof STRATEGIC_DIMENSIONS[number];

export const STRATEGIC_INTENT = 'strategic_intent';

// Dimensional Coverage Types
export type CoverageConfidence = 'high' | 'medium' | 'low';

export interface DimensionCoverage {
  covered: boolean;
  confidence: CoverageConfidence;
  themes: string[];  // Which emergent theme(s) mapped to this dimension
}

export interface DimensionalCoverage {
  // Coverage by dimension
  dimensions: {
    [K in StrategicDimension]: DimensionCoverage;
  };

  // Summary metrics
  summary: {
    dimensionsCovered: number;  // out of 10
    coveragePercentage: number; // 0-100
    gaps: StrategicDimension[];  // dimensions with no coverage
    primaryDimensions: StrategicDimension[];  // dimensions with high confidence
  };

  // Metadata
  analysisTimestamp: string;
  modelUsed: string;
}
```

**Reasoning:**
- Const array + type extraction ensures type safety
- Separate strategic_intent from dimensions (per taxonomy design)
- Coverage confidence matches existing confidence types
- Summary metrics enable quick gap analysis
- Metadata enables tracking model improvements

---

### Step 2: Dimensional Analysis Function

**File:** `src/lib/dimensional-analysis.ts` (NEW)

**Purpose:** Core logic for mapping emergent themes to strategic dimensions

**Key Functions:**

```typescript
import { anthropic, CLAUDE_MODEL } from '@/lib/claude';
import {
  EmergentExtractedContext,
  DimensionalCoverage,
  STRATEGIC_DIMENSIONS,
  StrategicDimension,
  CoverageConfidence,
} from '@/lib/types';

/**
 * Analyzes emergent themes and maps them to strategic dimensions
 *
 * @param extractedContext - The emergent extraction result
 * @param conversationHistory - Full conversation text for context
 * @returns Dimensional coverage analysis
 */
export async function analyzeDimensionalCoverage(
  extractedContext: EmergentExtractedContext,
  conversationHistory: string
): Promise<DimensionalCoverage> {
  // Build prompt with dimension definitions
  const prompt = buildDimensionalAnalysisPrompt(
    extractedContext,
    conversationHistory
  );

  // Call Claude to map themes to dimensions
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2, // Lower temp for consistent tagging
  });

  const content = response.content[0]?.type === 'text'
    ? response.content[0].text
    : '';

  // Parse response into DimensionalCoverage structure
  const coverage = parseDimensionalCoverageResponse(content, extractedContext);

  return coverage;
}

function buildDimensionalAnalysisPrompt(
  extractedContext: EmergentExtractedContext,
  conversationHistory: string
): string {
  // Dimension definitions from TAXONOMY_REFERENCE.md
  const dimensionDefinitions = `
1. Customer & Market - Who we serve, their problems, buying behaviour, market dynamics
2. Problem & Opportunity - The problem space, opportunity size, why now, market need
3. Value Proposition - What we offer, how it solves problems, why it matters to customers
4. Differentiation & Advantage - What makes us unique, defensibility, right to win, moats
5. Competitive Landscape - Who else plays, their strengths/weaknesses, positioning, substitutes
6. Business Model & Economics - How we create/capture value, unit economics, growth model, pricing
7. Go-to-Market - Sales strategy, customer success, growth channels, acquisition
8. Product Experience - The experience we're creating, usability, customer journey
9. Capabilities & Assets - What we can do, what we have, team, technology, IP
10. Risks & Constraints - What could go wrong, dependencies, limitations, the 4 big risks`;

  const themesText = extractedContext.themes
    .map(t => `Theme: "${t.theme_name}"\n${t.content}`)
    .join('\n\n');

  return `You are analyzing emergent themes from a business strategy conversation to assess dimensional coverage.

STRATEGIC DIMENSIONS:
${dimensionDefinitions}

EMERGENT THEMES EXTRACTED:
${themesText}

CONVERSATION CONTEXT:
${conversationHistory}

For each of the 10 strategic dimensions, assess:
1. Is this dimension covered by any emergent theme(s)?
2. If yes, which theme(s) map to this dimension?
3. What is your confidence in this coverage? (high/medium/low)

Guidelines:
- A theme can map to multiple dimensions
- A dimension can be covered by multiple themes
- High confidence = theme directly addresses dimension with specific details
- Medium confidence = theme touches on dimension but lacks depth
- Low confidence = theme only tangentially relates to dimension

Output format:

<dimensional_coverage>
  <dimension name="customer_and_market">
    <covered>true/false</covered>
    <confidence>high/medium/low</confidence>
    <themes>
      <theme>Theme name that maps here</theme>
    </themes>
  </dimension>
  <!-- Repeat for all 10 dimensions -->
</dimensional_coverage>`;
}

function parseDimensionalCoverageResponse(
  xml: string,
  extractedContext: EmergentExtractedContext
): DimensionalCoverage {
  // Extract <dimensional_coverage> block
  const coverageRegex = /<dimensional_coverage>([\s\S]*?)<\/dimensional_coverage>/;
  const match = xml.match(coverageRegex);
  const coverageXML = match ? match[1] : '';

  // Parse each dimension
  const dimensions: any = {};

  for (const dimension of STRATEGIC_DIMENSIONS) {
    const dimRegex = new RegExp(
      `<dimension name="${dimension}"[^>]*>([\\s\\S]*?)</dimension>`,
      'i'
    );
    const dimMatch = coverageXML.match(dimRegex);

    if (dimMatch) {
      const dimContent = dimMatch[1];

      const covered = /<covered>true<\/covered>/i.test(dimContent);

      const confMatch = dimContent.match(/<confidence>(high|medium|low)<\/confidence>/i);
      const confidence: CoverageConfidence = confMatch
        ? (confMatch[1].toLowerCase() as CoverageConfidence)
        : 'low';

      const themeMatches = dimContent.matchAll(/<theme>([^<]+)<\/theme>/gi);
      const themes = Array.from(themeMatches).map(m => m[1].trim());

      dimensions[dimension] = {
        covered,
        confidence,
        themes,
      };
    } else {
      // Default if dimension not found in response
      dimensions[dimension] = {
        covered: false,
        confidence: 'low' as CoverageConfidence,
        themes: [],
      };
    }
  }

  // Calculate summary metrics
  const coveredDimensions = STRATEGIC_DIMENSIONS.filter(
    d => dimensions[d].covered
  );

  const primaryDimensions = STRATEGIC_DIMENSIONS.filter(
    d => dimensions[d].covered && dimensions[d].confidence === 'high'
  );

  const gaps = STRATEGIC_DIMENSIONS.filter(
    d => !dimensions[d].covered
  );

  return {
    dimensions,
    summary: {
      dimensionsCovered: coveredDimensions.length,
      coveragePercentage: Math.round((coveredDimensions.length / 10) * 100),
      gaps,
      primaryDimensions,
    },
    analysisTimestamp: new Date().toISOString(),
    modelUsed: CLAUDE_MODEL,
  };
}
```

**Reasoning:**
- Includes dimension definitions in prompt (self-contained, no external dependencies)
- Lower temperature (0.2) for consistent tagging
- Clear XML output format for reliable parsing
- Graceful fallback if dimension missing from response
- Summary metrics calculated from parsed data

---

### Step 3: Database Schema Migration

**File:** `prisma/schema.prisma`

**Modify Trace model:**

```prisma
model Trace {
  id                  String   @id @default(cuid())
  conversationId      String
  userId              String?
  timestamp           DateTime @default(now())

  // Extracted Context (stored as JSON)
  extractedContext    Json

  // [NEW] Dimensional Coverage (stored as JSON)
  dimensionalCoverage Json?

  // Generated Output (stored as JSON)
  output              Json
  claudeThoughts      String?  @db.Text

  // ... rest of fields unchanged
}
```

**Migration command:**

```bash
npx prisma migrate dev --name add_dimensional_coverage
```

**Reasoning:**
- Use Json field (flexible, no schema changes needed as we evolve)
- Nullable (only applies to emergent extraction, not prescriptive)
- Can query in Jupyter notebooks via `json_extract` or direct JSON parsing

---

### Step 4: Integrate into Extraction Flow

**File:** `src/app/api/extract/route.ts`

**Modify POST handler:**

```typescript
import { analyzeDimensionalCoverage } from '@/lib/dimensional-analysis';
import { isEmergentContext } from '@/lib/types';

export async function POST(req: Request) {
  try {
    // ... existing extraction logic ...

    // After extraction completes (line ~263)
    console.log('[Extract] Returning extraction data:', {
      extraction_approach: extractedContext.extraction_approach,
      hasCore: 'core' in extractedContext,
      hasThemes: 'themes' in extractedContext,
      keys: Object.keys(extractedContext),
    });

    // [NEW] Trigger dimensional analysis for emergent extraction
    // Run asynchronously - don't block user flow
    if (isEmergentContext(extractedContext)) {
      analyzeDimensionalCoverageAsync(
        conversation.id,
        extractedContext,
        conversationHistory
      ).catch(error => {
        console.error('[Extract] Dimensional analysis failed:', error);
        // Don't fail the extraction - this is supplementary data
      });
    }

    return NextResponse.json({
      extractedContext,
    });
  } catch (error) {
    // ... existing error handling ...
  }
}

/**
 * Runs dimensional analysis asynchronously and stores result in Trace
 * when generation happens
 */
async function analyzeDimensionalCoverageAsync(
  conversationId: string,
  extractedContext: EmergentExtractedContext,
  conversationHistory: string
) {
  console.log('[DimensionalAnalysis] Starting async analysis for conversation:', conversationId);

  try {
    const coverage = await analyzeDimensionalCoverage(
      extractedContext,
      conversationHistory
    );

    console.log('[DimensionalAnalysis] Coverage computed:', {
      conversationId,
      dimensionsCovered: coverage.summary.dimensionsCovered,
      gaps: coverage.summary.gaps,
    });

    // Store in a temporary cache or attach to conversation
    // Will be persisted when Trace is created during generation
    // For now, store in conversation metadata
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        // We can use a JSON field or create a separate DimensionalAnalysis table
        // For simplicity, store in Trace when it's created
        // So we'll pass this through the generate API
      },
    });

  } catch (error) {
    console.error('[DimensionalAnalysis] Analysis failed:', error);
    throw error;
  }
}
```

**Wait, there's a timing issue here.** The Trace is created during generation, not extraction. Let me reconsider the flow.

**Better approach:** Store dimensional coverage in the Trace when it's created during `/api/generate`.

**Revised integration:**

1. Run dimensional analysis during extraction (blocking is OK - happens when user reviews extraction UI)
2. Return dimensional coverage alongside extractedContext
3. Frontend passes it to generate API
4. Generate API stores it in Trace

**Revised code for `src/app/api/extract/route.ts`:**

```typescript
export async function POST(req: Request) {
  try {
    // ... existing extraction logic up to line 263 ...

    // [NEW] Run dimensional analysis for emergent extraction
    let dimensionalCoverage = null;

    if (isEmergentContext(extractedContext)) {
      console.log('[Extract] Running dimensional analysis...');
      dimensionalCoverage = await analyzeDimensionalCoverage(
        extractedContext,
        conversationHistory
      );

      console.log('[Extract] Dimensional coverage:', {
        dimensionsCovered: dimensionalCoverage.summary.dimensionsCovered,
        coveragePercentage: dimensionalCoverage.summary.coveragePercentage,
        gaps: dimensionalCoverage.summary.gaps,
      });
    }

    return NextResponse.json({
      extractedContext,
      dimensionalCoverage, // [NEW] Include in response
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

**Reasoning:**
- Run blocking during extraction phase (user is reviewing UI anyway)
- Return alongside extractedContext
- Frontend doesn't need to change (can pass through to generate)
- Simpler than async coordination

---

### Step 5: Update Generation API to Store Coverage

**File:** `src/app/api/generate/route.ts`

**Read current implementation first, then modify:**

```typescript
// In the POST handler, accept dimensionalCoverage from request body

export async function POST(req: Request) {
  try {
    const { conversationId, extractedContext, dimensionalCoverage } = await req.json();

    // ... existing generation logic ...

    // When creating Trace, include dimensionalCoverage
    const trace = await prisma.trace.create({
      data: {
        conversationId,
        userId: conversation.userId,
        extractedContext,
        dimensionalCoverage, // [NEW] Store dimensional coverage
        output: statements,
        claudeThoughts: thoughts,
        modelUsed: CLAUDE_MODEL,
        totalTokens: usage.input_tokens + usage.output_tokens,
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        latencyMs,
      },
    });

    // ... rest of handler ...
  } catch (error) {
    // ... error handling ...
  }
}
```

---

### Step 6: Update Frontend to Pass Coverage Through

**File:** Look for component that calls `/api/extract` and `/api/generate`

**Need to find:** Component handling extraction confirmation

Let me check what calls the extract API:

```typescript
// Likely in src/components/ExtractionConfirm.tsx or similar
// Need to read to see how it flows
```

**Action:** Read ExtractionConfirm component to understand data flow

---

### Step 7: Enable Jupyter Notebook Queries

**File:** `scripts/dimensional_coverage_analysis.py` (NEW)

**Purpose:** Provide researchers with tools to analyze dimensional coverage

```python
import pandas as pd
import json
from sqlalchemy import create_engine
import os

# Connect to database
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)

def load_dimensional_coverage():
    """
    Load all traces with dimensional coverage data
    """
    query = """
    SELECT
        t.id as trace_id,
        t."conversationId",
        t.timestamp,
        t."extractedContext",
        t."dimensionalCoverage",
        t.output,
        t."qualityRating",
        c."experimentVariant"
    FROM "Trace" t
    JOIN "Conversation" c ON t."conversationId" = c.id
    WHERE t."dimensionalCoverage" IS NOT NULL
    ORDER BY t.timestamp DESC
    """

    df = pd.read_sql(query, engine)

    # Parse JSON fields
    df['dimensionalCoverage'] = df['dimensionalCoverage'].apply(json.loads)
    df['extractedContext'] = df['extractedContext'].apply(json.loads)

    return df

def analyze_coverage_patterns(df):
    """
    Analyze which dimensions are typically well-covered vs sparse
    """
    coverage_stats = {
        'dimension': [],
        'coverage_rate': [],
        'avg_confidence_when_covered': [],
        'total_traces': len(df),
    }

    from src.lib.types import STRATEGIC_DIMENSIONS

    for dimension in STRATEGIC_DIMENSIONS:
        covered_count = 0
        confidence_scores = []

        for idx, row in df.iterrows():
            dim_data = row['dimensionalCoverage']['dimensions'].get(dimension)
            if dim_data and dim_data['covered']:
                covered_count += 1
                # Map confidence to numeric
                conf_map = {'high': 3, 'medium': 2, 'low': 1}
                confidence_scores.append(conf_map[dim_data['confidence']])

        coverage_stats['dimension'].append(dimension)
        coverage_stats['coverage_rate'].append(covered_count / len(df))
        coverage_stats['avg_confidence_when_covered'].append(
            sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        )

    return pd.DataFrame(coverage_stats).sort_values('coverage_rate', ascending=False)

def find_systematic_gaps(df):
    """
    Identify dimensions that are systematically missed
    """
    gaps_analysis = analyze_coverage_patterns(df)

    # Dimensions covered in <50% of conversations
    systematic_gaps = gaps_analysis[gaps_analysis['coverage_rate'] < 0.5]

    return systematic_gaps

# Example usage:
# df = load_dimensional_coverage()
# coverage_patterns = analyze_coverage_patterns(df)
# print(coverage_patterns)
#
# systematic_gaps = find_systematic_gaps(df)
# print("Systematic gaps:", systematic_gaps)
```

**Reasoning:**
- Standard data science tooling (pandas, SQLAlchemy)
- Easy to extend for additional analyses
- Direct SQL access (faster than Prisma for analytics)
- Can be run in Jupyter notebooks for interactive exploration

---

## Testing Strategy

### Unit Tests

**File:** `src/lib/__tests__/dimensional-analysis.test.ts`

**Test cases:**
1. Parse valid dimensional coverage XML
2. Handle missing dimensions gracefully
3. Calculate summary metrics correctly
4. Map multiple themes to one dimension
5. Map one theme to multiple dimensions

### Integration Tests

**File:** `src/app/api/extract/__tests__/dimensional-coverage.test.ts`

**Test cases:**
1. Emergent extraction includes dimensional coverage
2. Prescriptive extraction does NOT include dimensional coverage
3. Coverage stored correctly in Trace
4. Coverage queryable from Trace API

### Manual Testing

**Checklist:**
1. Complete Experiment 1 (emergent extraction) conversation → verify coverage in Trace
2. Complete Experiment 0 (baseline-v1) conversation → verify no coverage in Trace
3. Query Trace via API → verify coverage returned
4. Run Jupyter analysis → verify queries work

---

## Implementation Checklist

### Phase 0: Setup
- [ ] Create feature branch: `git checkout -b experiment/e2-dimensional-coverage`
- [ ] Verify development branch is up to date
- [ ] Review deployment strategy: `docs/plans/2026-01-03-e2-deployment-strategy.md`

### Phase 1: Core Infrastructure
- [ ] Add type definitions to `src/lib/types.ts`
- [ ] Create `src/lib/dimensional-analysis.ts` with core logic
- [ ] Add Prisma schema migration for `dimensionalCoverage` field
- [ ] Run migration: `npx prisma migrate dev --name add_dimensional_coverage`
- [ ] Generate Prisma client: `npx prisma generate`

### Phase 2: API Integration
- [ ] Modify `src/app/api/extract/route.ts` to run dimensional analysis
- [ ] Read `src/app/api/generate/route.ts` to understand Trace creation
- [ ] Modify generate API to accept and store `dimensionalCoverage`
- [ ] Read frontend extraction component to understand data flow
- [ ] Update frontend to pass `dimensionalCoverage` to generate API

### Phase 3: Querying & Analysis
- [ ] Verify Trace API returns `dimensionalCoverage` in responses
- [ ] Create `scripts/dimensional_coverage_analysis.py`
- [ ] Create experiment one-pager: `docs/experiments/one-pagers/E2-dimensional-coverage.md`

### Phase 4: Testing
- [ ] Write unit tests for dimensional analysis parsing
- [ ] Write integration tests for API flow
- [ ] Manual testing: complete E1a conversation and verify coverage
- [ ] Manual testing: query coverage via Jupyter notebook

### Phase 5: Documentation
- [ ] Create E2 one-pager with dimensional coverage details
- [ ] Add dimensional coverage analysis to experiment measurement plan
- [ ] Document Jupyter notebook usage for researchers
- [ ] Update experiment register with E2 status

---

## Success Validation

**Before marking complete, verify:**

1. ✅ Dimensional coverage captured for all Experiment 1 (emergent extraction) conversations
2. ✅ Coverage NOT captured for Experiment 0 (baseline-v1) - null in database
3. ✅ Researchers can query coverage via Jupyter notebooks
4. ✅ Coverage data includes all 10 dimensions + summary metrics
5. ✅ No user-facing UX changes (users don't see dimensional tagging)
6. ✅ Emergent theme quality unaffected (compare sample outputs)

---

## Open Questions & Decisions Needed

### Q1: Asynchronous vs Synchronous Analysis?

**Decision:** Synchronous (blocking during extraction phase)

**Rationale:** User is already waiting while reviewing extraction UI. Adding 1-2 seconds for dimensional analysis is acceptable. Simpler implementation (no async coordination).

### Q2: Where to store coverage before Trace creation?

**Decision:** Return from extract API, pass through frontend to generate API

**Rationale:** Simpler than storing in intermediate state. Frontend already passes extractedContext to generate, can include dimensionalCoverage alongside.

### Q3: Should coverage influence user experience?

**Decision:** No, not in this enhancement

**Scope:** This is data collection only. Future enhancement (out of scope) could use gaps to guide questioning.

### Q4: Do we need a separate DimensionalAnalysis table?

**Decision:** No, store as JSON in Trace.dimensionalCoverage

**Rationale:** Coverage is metadata about a Trace. Storing as JSON keeps it simple and queryable. Can normalize later if needed.

---

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Core Infrastructure | Types, analysis function, migration | 2-3 hours |
| Phase 2: API Integration | Extract/generate API, frontend passthrough | 2-3 hours |
| Phase 3: Querying & Analysis | Jupyter scripts, documentation | 1-2 hours |
| Phase 4: Testing | Unit tests, integration tests, manual testing | 2-3 hours |
| Phase 5: Documentation | Update docs, write usage guide | 1 hour |
| **Total** | | **8-12 hours** |

---

## Risk Mitigation

### Risk 1: Dimensional analysis affects emergent theme quality

**Mitigation:** Analysis runs AFTER extraction, using separate API call. No prompt contamination.

**Validation:** Compare theme quality before/after (sample 5-10 traces)

### Risk 2: Latency impact on user experience

**Mitigation:** Analysis runs during extraction phase when user is reviewing UI. Acceptable 1-2 second delay.

**Validation:** Monitor latency metrics, ensure <2s for dimensional analysis

### Risk 3: Incorrect dimensional tagging

**Mitigation:** Lower temperature (0.2) for consistency. Include dimension definitions in prompt. Researcher review catches errors.

**Validation:** Manual review of first 10-20 traces, error-code tagging mistakes

### Risk 4: Schema migration issues

**Mitigation:** Nullable field (doesn't break existing data). Test migration on dev database first.

**Validation:** Run migration on dev, verify existing traces unaffected

---

## Future Experiments (Out of Scope)

These enhancements are captured in the experiment register as potential future experiments:

1. **E3: Proactive Gap-Based Questioning** - Use coverage gaps to guide conversation toward under-covered dimensions
2. **E4: Real-time Coverage Display** - Show dimensional coverage to users during conversation for transparency
3. **E5: Multi-Session Coverage Accumulation** - Track coverage across multiple conversations for evolving strategic context
4. **E6: LLM-as-Judge Training** - Use coverage data to train quality evaluation models
5. **E7: Sub-Dimension Emergence** - Identify patterns within dimensions that could become sub-dimensions

See `docs/experiments/EXPERIMENT_REGISTER.md` for details.

---

## References

- `docs/plans/strategic/TAXONOMY_REFERENCE.md` - Dimension definitions
- `docs/plans/strategic/2026-01-03-taxonomy-design-session.md` - Design context
- `docs/plans/strategic/2026-01-03-e1a-enhancement-briefing.md` - Enhancement briefing
- `docs/experiments/one-pagers/E1-emergent-extraction.md` - Experiment 1
- `docs/experiments/EXPERIMENT_REGISTER.md` - Experiment tracking
- `src/lib/types.ts` - Current type definitions
- `src/app/api/extract/route.ts` - Current extraction flow

---

**Plan Status:** Ready for Implementation
**Next Step:** Begin Phase 1 (Core Infrastructure)
