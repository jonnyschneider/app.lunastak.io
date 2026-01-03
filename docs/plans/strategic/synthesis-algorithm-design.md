# Synthesis Algorithm Design: Fragments → Dimensional Understanding

**Status:** Design Proposal
**Created:** 2026-01-03
**Related:** `proposed-schema-v1.prisma`, `2026-01-03-synthesis-compression-brief.md`

---

## Problem Statement

**Input:** Collection of fragments tagged to a dimension (e.g., 15 fragments about "Customer & Market")
**Output:** Synthesized understanding (summary, themes, quotes, gaps, subdimensions)
**Constraint:** Must work incrementally (new fragments → update synthesis, don't re-process everything)

---

## Design Principles

1. **Incremental synthesis**: New fragments merge into existing synthesis, not full re-synthesis every time
2. **Preserve voice**: Keep user's authentic language in quotes and themes
3. **Surface contradictions**: Don't hide conflicts, expose them for user to resolve
4. **Identify gaps**: What's missing from this dimension?
5. **Structured + emergent**: Core fields are structured, subdimensions emerge from data

---

## Synthesis Triggers

When does synthesis update happen?

### Option A: Real-time (per-fragment)
Every fragment added → synthesis updates immediately

**Pros:** Always fresh
**Cons:** Expensive, many LLM calls, might be noisy

### Option B: Batch (end of extraction step) ✅ RECOMMENDED
After extraction completes → update all affected dimension syntheses

**Pros:** Efficient, aligns with user flow, one synthesis per dimension per session
**Cons:** Synthesis lags during conversation

### Option C: Manual trigger
User clicks "Synthesize" button

**Pros:** User control, no surprise costs
**Cons:** Extra friction, might forget to trigger

**Decision:** Use **Option B** (batch at extraction step), with optional manual trigger for re-synthesis.

---

## Synthesis Algorithm

### High-Level Flow

```typescript
async function updateDimensionalSynthesis(
  projectId: string,
  dimension: string
) {
  // 1. Get existing synthesis
  const existingSynthesis = await getExistingSynthesis(projectId, dimension)

  // 2. Get all active fragments for this dimension
  const fragments = await getActiveFragments(projectId, dimension)

  if (fragments.length === 0) {
    return markSynthesisAsEmpty(projectId, dimension)
  }

  // 3. Decide: full synthesis or incremental update?
  const newFragments = fragments.filter(f =>
    f.createdAt > existingSynthesis.lastSynthesizedAt
  )

  let synthesis
  if (shouldFullSynthesis(existingSynthesis, fragments, newFragments)) {
    // Full synthesis from all fragments
    synthesis = await fullSynthesis(dimension, fragments)
  } else {
    // Incremental: merge new fragments into existing synthesis
    synthesis = await incrementalSynthesis(
      dimension,
      existingSynthesis,
      newFragments
    )
  }

  // 4. Save synthesis
  await saveSynthesis(projectId, dimension, synthesis)
}
```

### When to Full Synthesis vs. Incremental?

```typescript
function shouldFullSynthesis(
  existingSynthesis: DimensionalSynthesis,
  allFragments: Fragment[],
  newFragments: Fragment[]
): boolean {
  // Always do full synthesis if:

  // 1. No existing synthesis (first time)
  if (!existingSynthesis.summary) return true

  // 2. Synthesis is stale (> 30 days old)
  const daysSinceLastSynthesis =
    (Date.now() - existingSynthesis.lastSynthesizedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastSynthesis > 30) return true

  // 3. Fragments have changed significantly (> 50% new)
  const newRatio = newFragments.length / allFragments.length
  if (newRatio > 0.5) return true

  // 4. User requested re-synthesis (via manual trigger)
  // (handled separately in UI)

  // Otherwise, use incremental
  return false
}
```

---

## Full Synthesis Prompt

```typescript
async function fullSynthesis(
  dimension: string,
  fragments: Fragment[]
): Promise<SynthesisResult> {
  const prompt = `You are synthesizing strategic understanding for the dimension: **${dimension}**.

You have ${fragments.length} fragments captured from conversations and documents. Your task is to synthesize these into a coherent understanding.

## Fragments:

${fragments.map((f, i) => `
### Fragment ${i + 1}
Source: ${f.sourceType}
Confidence: ${f.confidence}
Content:
${f.content}
`).join('\n---\n')}

## Your Task:

Synthesize these fragments into structured understanding:

1. **Summary** (2-3 paragraphs): What do we understand about ${dimension}? Use the leader's authentic voice where possible.

2. **Key Themes** (3-7 themes): What are the main ideas? Each theme should be a short phrase or sentence.

3. **Key Quotes** (3-5 quotes): Verbatim quotes that capture the essence. Use exact wording from fragments.

4. **Gaps** (list): What's missing? What would deepen our understanding of ${dimension}?

5. **Contradictions** (list): Are there conflicting fragments? Surface tensions, don't hide them.

6. **Subdimensions** (emergent): Are there natural groupings or sub-categories within these fragments? For example, if dimension is "Customer & Market", subdimensions might be "Enterprise Customers" vs "SMB Customers". Only include if clearly evident.

7. **Confidence** (HIGH | MEDIUM | LOW): How comprehensive is this understanding?

Return JSON:
{
  "summary": "...",
  "keyThemes": ["...", "..."],
  "keyQuotes": ["...", "..."],
  "gaps": ["...", "..."],
  "contradictions": ["...", "..."],
  "subdimensions": {
    "subdimension_name": {
      "summary": "...",
      "fragments": [0, 3, 5]  // Fragment indices
    }
  },
  "confidence": "HIGH"
}
`

  const response = await callLLM(prompt)
  return JSON.parse(response)
}
```

---

## Incremental Synthesis Prompt

```typescript
async function incrementalSynthesis(
  dimension: string,
  existingSynthesis: DimensionalSynthesis,
  newFragments: Fragment[]
): Promise<SynthesisResult> {
  const prompt = `You are updating strategic understanding for the dimension: **${dimension}**.

## Existing Synthesis:

Summary:
${existingSynthesis.summary}

Key Themes:
${existingSynthesis.keyThemes.join('\n- ')}

Gaps:
${existingSynthesis.gaps.join('\n- ')}

Subdimensions:
${JSON.stringify(existingSynthesis.subdimensions, null, 2)}

Confidence: ${existingSynthesis.confidence}

---

## New Fragments:

${newFragments.map((f, i) => `
### Fragment ${i + 1}
${f.content}
`).join('\n---\n')}

## Your Task:

These new fragments have been added since the last synthesis. Update the existing synthesis by:

1. **Enriching the summary** with new insights (don't rewrite, just enhance)
2. **Adding new themes** if distinct from existing
3. **Adding new quotes** that capture important ideas
4. **Updating gaps** (remove gaps that are now filled, add new gaps discovered)
5. **Surfacing contradictions** if new fragments conflict with existing understanding
6. **Updating subdimensions** if new fragments reveal sub-categories
7. **Re-assessing confidence** based on new information

Return JSON with UPDATED synthesis (not just deltas):
{
  "summary": "... (updated) ...",
  "keyThemes": ["... (existing + new) ..."],
  "keyQuotes": ["... (existing + new) ..."],
  "gaps": ["... (updated) ..."],
  "contradictions": ["..."],
  "subdimensions": { ... (updated) ... },
  "confidence": "HIGH"
}
`

  const response = await callLLM(prompt)
  return JSON.parse(response)
}
```

---

## Handling Contradictions

When fragments contradict each other, don't resolve — **surface the tension**:

```json
{
  "contradictions": [
    "Fragment 3 says 'target market is enterprise' but Fragment 8 says 'focus on SMBs'",
    "Pricing model unclear: Fragment 5 suggests subscription, Fragment 12 suggests usage-based"
  ]
}
```

This signals to user: "I need clarification here."

In generation step, you can:
- Ask user to resolve contradiction
- Present both options
- Make a judgment call and note the uncertainty

---

## Identifying Gaps

Use dimension reference to know what "complete" looks like:

```typescript
async function identifyGaps(
  dimension: string,
  fragments: Fragment[]
): Promise<string[]> {
  const dimensionReference = getDimensionReference(dimension)
  // e.g., for CUSTOMER_MARKET: "Who, Problems, Buying behavior, Market size, Segments"

  const prompt = `Given these fragments about ${dimension}, what's missing?

Dimension reference (what we should understand):
${dimensionReference}

Fragments:
${fragments.map(f => f.content).join('\n\n')}

What key aspects are missing or unclear?
Return as array: ["gap 1", "gap 2", ...]
`

  const response = await callLLM(prompt)
  return JSON.parse(response)
}
```

---

## Subdimension Emergence

Let subdimensions emerge from data, don't prescribe them:

```json
// Example: CUSTOMER_MARKET subdimensions emerge
{
  "subdimensions": {
    "enterprise_segment": {
      "summary": "Large organizations with complex procurement...",
      "fragmentIds": ["frag_abc", "frag_xyz"]
    },
    "smb_segment": {
      "summary": "Small businesses looking for simple solutions...",
      "fragmentIds": ["frag_def"]
    }
  }
}
```

**Rules:**
- Only create subdimension if ≥3 fragments cluster around it
- Use descriptive snake_case names
- Store fragment IDs for lineage

Later, you could promote common subdimensions to first-class fields if patterns emerge across many projects.

---

## Synthesis Validation

How do you know synthesis is "good enough" to archive fragments?

### Validation Criteria

```typescript
function isSynthesisValidated(synthesis: DimensionalSynthesis): boolean {
  return (
    synthesis.confidence === "HIGH" &&
    synthesis.summary.length > 200 && // Substantive summary
    synthesis.keyThemes.length >= 3 && // Multiple themes
    synthesis.gaps.length <= 2 && // Few gaps
    synthesis.fragmentCount >= 5 // Enough fragments
  )
}
```

### Validation Workflow

1. After synthesis, check validation criteria
2. If validated → mark fragments as `status = "archived"`
3. If not validated → fragments stay `active`, synthesis confidence stays MEDIUM/LOW
4. User never sees "archived" status — fragments just fade from UI

```typescript
async function archiveFragmentsIfValidated(
  projectId: string,
  dimension: string
) {
  const synthesis = await prisma.dimensionalSynthesis.findUnique({
    where: { projectId_dimension: { projectId, dimension } }
  })

  if (!isSynthesisValidated(synthesis)) {
    return // Not ready to archive
  }

  // Archive fragments for this dimension
  await prisma.fragment.updateMany({
    where: {
      projectId,
      status: "active",
      dimensionTags: {
        some: { dimension }
      }
    },
    data: {
      status: "archived",
      archivedAt: new Date(),
      archivedReason: "synthesis_validated"
    }
  })

  console.log(`Archived fragments for ${dimension} in project ${projectId}`)
}
```

---

## Performance Considerations

### Token Optimization

**Problem:** If you have 100 fragments × 200 tokens each = 20,000 tokens just for input

**Solution:** Summarize fragments first, then synthesize summaries

```typescript
async function optimizedFullSynthesis(
  dimension: string,
  fragments: Fragment[]
): Promise<SynthesisResult> {
  if (fragments.length > 30) {
    // Too many fragments — cluster first
    const clusters = await clusterFragments(fragments)

    const clusterSummaries = await Promise.all(
      clusters.map(cluster => summarizeCluster(cluster))
    )

    return synthesizeFromSummaries(dimension, clusterSummaries)
  }

  // Otherwise, full synthesis as normal
  return fullSynthesis(dimension, fragments)
}
```

### Caching

Cache synthesis results to avoid redundant LLM calls:

```typescript
// Check if fragments have changed since last synthesis
const lastSynthesis = existingSynthesis.lastSynthesizedAt
const hasNewFragments = await prisma.fragment.count({
  where: {
    projectId,
    dimensionTags: { some: { dimension } },
    createdAt: { gt: lastSynthesis }
  }
})

if (hasNewFragments === 0) {
  return existingSynthesis // No changes, return cached
}
```

---

## Implementation Checklist

- [ ] Create `lib/synthesis/update-synthesis.ts`
- [ ] Create `lib/synthesis/full-synthesis.ts`
- [ ] Create `lib/synthesis/incremental-synthesis.ts`
- [ ] Create `lib/synthesis/identify-gaps.ts`
- [ ] Create `lib/synthesis/validate-synthesis.ts`
- [ ] Add synthesis trigger to extraction flow
- [ ] Add manual re-synthesis UI button
- [ ] Add fragment archival after validation
- [ ] Add synthesis quality monitoring (log confidence levels)
- [ ] Add error handling (synthesis fails → keep old synthesis, log error)

---

## Testing Strategy

### Unit Tests

```typescript
describe('Synthesis Algorithm', () => {
  it('should create full synthesis from fragments', async () => {
    const fragments = [
      { content: 'Our customers are enterprise SaaS companies' },
      { content: 'They struggle with data integration' },
      { content: 'Buying cycle is 3-6 months with IT approval' }
    ]

    const synthesis = await fullSynthesis('CUSTOMER_MARKET', fragments)

    expect(synthesis.confidence).toBe('MEDIUM')
    expect(synthesis.keyThemes.length).toBeGreaterThan(0)
    expect(synthesis.summary).toContain('enterprise')
  })

  it('should incrementally update synthesis', async () => {
    const existingSynthesis = {
      summary: 'Customers are enterprise SaaS',
      keyThemes: ['enterprise', 'SaaS'],
      confidence: 'MEDIUM'
    }

    const newFragments = [
      { content: 'We also serve mid-market companies' }
    ]

    const updated = await incrementalSynthesis(
      'CUSTOMER_MARKET',
      existingSynthesis,
      newFragments
    )

    expect(updated.keyThemes).toContain('mid-market')
  })
})
```

### Integration Tests

1. Create conversation with 10 messages
2. Extract fragments
3. Verify syntheses created for all tagged dimensions
4. Add new conversation
5. Verify syntheses updated (not replaced)

---

## Future Enhancements

### Cross-Session Learning

Use embeddings to find similar fragments across sessions:

```typescript
// When synthesizing CUSTOMER_MARKET, pull in related fragments from past sessions
const relatedFragments = await findSimilarFragments(dimension, fragments)
```

### LLM-as-Judge for Quality

Evaluate synthesis quality automatically:

```typescript
const quality = await evaluateSynthesisQuality(synthesis, fragments)
// Returns: { score: 0.85, issues: [...], suggestions: [...] }
```

### Collaborative Synthesis

Allow users to edit synthesis directly:

```typescript
model DimensionalSynthesis {
  summary          String?  @db.Text
  userEditedSummary String?  @db.Text  // User override
}
```

---

## Open Questions

- [ ] Should subdimensions be auto-created or suggested to user for confirmation?
- [ ] How to handle fragment deletion? Re-synthesize?
- [ ] Should synthesis track which fragments contributed to which themes?
- [ ] How to version synthesis format when it evolves?

---

**Next Steps:**
1. Implement basic full synthesis
2. Test with real conversation data
3. Add incremental synthesis
4. Tune prompts based on synthesis quality
5. Add validation and archival
