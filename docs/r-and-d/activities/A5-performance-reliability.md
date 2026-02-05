# Activity A5: Performance & Reliability

**Activity Code:** A5
**Type:** Supporting R&D Activity
**Period:** January 2026 - Ongoing

---

## Unknown Outcome

Whether LLM-based strategic systems can achieve response times acceptable to users without degrading output quality, given the inherent latency of large language model inference.

**Specific unknowns:**
1. What response time thresholds cause user abandonment in strategic contexts?
2. Can background processing maintain UX quality while hiding latency?
3. Do parallelisation strategies degrade output coherence?
4. What serverless-specific patterns are required for reliability?

---

## Why Existing Knowledge is Insufficient

1. **LLM latency is structural:** Unlike traditional web applications, LLM inference takes 10-60+ seconds. Standard UX patterns assume sub-second responses.

2. **Strategic context differs:** Users may tolerate longer waits for "thinking" tasks, but thresholds are unknown. Too slow and users abandon; too fast may reduce perceived value.

3. **Serverless constraints:** Vercel's serverless environment has timeouts, cold starts, and no persistent connections. Standard LLM deployment patterns don't apply.

4. **Quality/speed trade-off unknown:** Faster responses (shorter prompts, smaller models) may degrade strategic output quality. The curve is unexplored.

---

## Systematic Work Conducted

### 1. Timeout & Reliability Patterns (v1.5.1)

**Challenge:** Claude API calls hanging indefinitely; users stuck on loading screens

**Solutions developed:**
- Claude API timeout reduced to 60 seconds (from 180s)
- Statsig initialization timeout of 5 seconds
- Truncation detection wrapper for all Claude calls

**Outcome:** Eliminated indefinite hangs; established baseline reliability

**Evidence:** v1.5.1 CHANGELOG

### 2. Fire-and-Forget Elimination (v1.5.1)

**Challenge:** Background tasks silently failing in serverless

**Problem identified:** Document uploads stuck "processing"; extraction synthesis not completing

**Solution:** All async operations explicitly awaited before response completion

**Outcome:** 100% task completion rate (was ~70% with fire-and-forget)

**Evidence:** v1.5.1 CHANGELOG, ARCHITECTURE.md "Known Compromises"

### 3. Cold Start Mitigation (v1.7.3)

**Challenge:** Database connections failing on serverless cold starts

**Problem identified:** `Error { kind: Closed, cause: None }` on first request after idle

**Solution:** Neon serverless adapter with HTTP-based queries instead of persistent connections

**Outcome:** Eliminated cold start connection errors entirely

**Evidence:** v1.7.3 CHANGELOG, `@neondatabase/serverless` integration

### 4. Background Strategy Generation (v1.7.6)

**Challenge:** Strategy generation takes 15-30 seconds; users forced to wait

**Solution developed:**
- `/api/generate` returns immediately with `generationId`
- Generation runs in background via Vercel `waitUntil()`
- Client polls `/api/generation-status/[id]` every 2 seconds
- Toast notification when complete

**Outcome:** Users can navigate freely during generation; perceived wait eliminated

**Evidence:** v1.7.6 CHANGELOG

### 5. Parallelisation Exploration (Ongoing)

**Challenge:** Sequential API calls multiply latency

**Work in progress:**
- Dimensional syntheses now run in parallel (was sequential)
- Knowledge summary waits for synthesis completion
- Exploring parallel extraction for multi-document scenarios

**Evidence:** v1.5.1 CHANGELOG ("Slow Extraction Performance" fix)

---

## New Knowledge Generated

### Validated Findings

1. **Serverless requires explicit completion:** Fire-and-forget patterns fail silently in serverless. All operations must be awaited.

2. **HTTP connections beat persistent:** For serverless with unpredictable cold starts, HTTP-based database queries are more reliable than connection pools.

3. **Background processing preserves UX:** Users accept "generating..." indicators if they can continue working. Blocking waits cause abandonment.

4. **60-second timeout is workable:** Most LLM operations complete within 60 seconds. Longer operations need architectural solutions (background processing), not longer timeouts.

### Pending Validation

- Optimal polling interval for status checks
- User perception of "thinking time" (does faster feel less valuable?)
- Parallelisation impact on output coherence
- Mobile network reliability patterns

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Timeout Implementation | v1.5.1 CHANGELOG | API timeout configuration |
| Cold Start Fix | v1.7.3 CHANGELOG | Neon adapter integration |
| Background Generation | v1.7.6 CHANGELOG | Fire-and-forget with polling |
| Architecture Decisions | `docs/ARCHITECTURE.md` | Known compromises section |
| Performance Fixes | Multiple CHANGELOG entries | Parallelisation, await patterns |

---

## Expenditure Allocation

Estimated **10%** of total R&D time allocated to A5 activities:
- Timeout and reliability pattern implementation
- Cold start diagnosis and mitigation
- Background processing architecture
- Parallelisation implementation
- Performance monitoring and iteration

---

## Relationship to Other Activities

- **A1 (Judgement Engine):** A5 ensures A1 outputs are delivered reliably
- **A4 (Interaction Design):** A5 constraints shape A4 loading states and feedback patterns
- **A2 (Observability):** A5 issues are detected through A2 instrumentation

---

## Why This is R&D (Not Standard DevOps)

Standard performance optimisation targets known bottlenecks with established solutions. A5 addresses research questions:

1. *What latency is acceptable for strategic thinking tasks?* (No prior research)
2. *Can LLM operations be backgrounded without confusing users?* (Novel UX pattern)
3. *Do serverless constraints fundamentally limit LLM applications?* (Architectural uncertainty)

If acceptable performance cannot be achieved, the product hypothesis fails regardless of A1 output quality.
