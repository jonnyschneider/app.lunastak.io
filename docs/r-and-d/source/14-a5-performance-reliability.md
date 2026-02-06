# 14. Area of Focus: Performance & Reliability

  -----------------------------------------------------------------------
  **Activity Code**      A5
  ---------------------- ------------------------------------------------
  **Type**               Supporting R&D Activity

  **Period**             January 2026 - Ongoing
  -----------------------------------------------------------------------

## Unknown Outcome

Whether LLM-based strategic systems can achieve response times acceptable to users without degrading output quality, given the inherent latency of large language model inference.

**Specific unknowns:**

+---------------------------------------------------------------------------------+
| > *What response time thresholds cause user abandonment in strategic contexts?* |
+---------------------------------------------------------------------------------+
| > *Can background processing maintain UX quality while hiding latency?*         |
+---------------------------------------------------------------------------------+
| > *Do parallelisation strategies degrade output coherence?*                     |
+---------------------------------------------------------------------------------+
| > *What serverless-specific patterns are required for reliability?*             |
+=================================================================================+

## Systematic Work Conducted

### 1. Timeout & Reliability Patterns (v1.5.1)

Claude API timeout reduced to 60 seconds, Statsig initialization timeout of 5 seconds, truncation detection wrapper for all Claude calls. Eliminated indefinite hangs.

### 2. Fire-and-Forget Elimination (v1.5.1)

All async operations explicitly awaited before response completion. Task completion rate improved from \~70% to 100%.

### 3. Cold Start Mitigation (v1.7.3)

Neon serverless adapter with HTTP-based queries instead of persistent connections. Eliminated cold start connection errors entirely.

### 4. Background Strategy Generation (v1.7.6)

/api/generate returns immediately with generationId, generation runs in background via Vercel waitUntil(), client polls status every 2 seconds, toast notification when complete. Users can navigate freely during generation.

### 5. Async Document Processing (2026-02-06)

**Challenge:** Document upload times out (504) because Unstructured API + Claude extraction runs synchronously in a single request.

**Uncertainty:** Can the background processing pattern from strategy generation be generalized to document processing with external API dependencies?

**Approach:** Apply same waitUntil + polling pattern: upload returns immediately, processing runs in background, client polls new status endpoint until complete/failed.

**Evidence:** docs/plans/2026-02-06-async-document-processing-design.md

## New Knowledge Generated

1.  **Serverless requires explicit completion:** Fire-and-forget patterns fail silently in serverless. All operations must be awaited.

2.  **HTTP connections beat persistent:** For serverless with unpredictable cold starts, HTTP-based database queries are more reliable than connection pools.

3.  **Background processing preserves UX:** Users accept \"generating\...\" indicators if they can continue working. Blocking waits cause abandonment.

4.  **60-second timeout is workable:** Most LLM operations complete within 60 seconds. Longer operations need architectural solutions, not longer timeouts.

## Why This is R&D (Not Standard DevOps)

Standard performance optimisation targets known bottlenecks with established solutions. A5 addresses research questions: What latency is acceptable for strategic thinking tasks? (No prior research). Can LLM operations be backgrounded without confusing users? (Novel UX pattern). Do serverless constraints fundamentally limit LLM applications? (Architectural uncertainty). If acceptable performance cannot be achieved, the product hypothesis fails regardless of A1 output quality.

## Expenditure Allocation

Estimated **10%** of total R&D time allocated to A5 activities.
