# 12. Area of Focus: Data Architecture & Multi-Session Knowledge

  -----------------------------------------------------------------------
  **Activity Code**      A3
  ---------------------- ------------------------------------------------
  **Type**               Supporting R&D Activity

  **Period**             January 2026 - Ongoing
  -----------------------------------------------------------------------

## Unknown Outcome

Whether a data architecture can be designed that enables strategic knowledge to accumulate across multiple sessions while maintaining coherence, supporting rapid experimentation, and preventing data corruption during schema evolution.

**Specific unknowns:**

+---------------------------------------------------------------------------------------------------+
| > *Can fragment-based architecture support continuous knowledge accumulation?*                    |
+---------------------------------------------------------------------------------------------------+
| > *Do TypeScript contracts at data boundaries catch breaking changes without excessive overhead?* |
+---------------------------------------------------------------------------------------------------+
| > *How should strategic insight be decomposed for storage and synthesis?*                         |
+---------------------------------------------------------------------------------------------------+
| > *Can incremental synthesis maintain coherence as knowledge accumulates?*                        |
+---------------------------------------------------------------------------------------------------+
| > *What schema patterns support both experimentation and production stability?*                   |
+===================================================================================================+

## Systematic Work Conducted

### 1. Fragment-Based Knowledge Architecture (v1.4.0)

Design decisions: Fragment model for discrete pieces of strategic insight, FragmentDimensionTag linking to strategic dimensions, source tracking, and temporal ordering for recency weighting.

### 2. Dimensional Synthesis (v1.4.0)

Algorithms developed: Full synthesis (process all fragments from scratch), incremental synthesis (merge new fragments into existing), and staleness detection.

### 3. Contract-Driven Quality System (v1.4.4)

TypeScript contracts at extraction/persistence/generation boundaries, contract validation tests, smoke tests for critical path verification, and pre-push hook enforcing verification.

## New Knowledge Generated

1.  **Fragments work:** Decomposing strategic insight into discrete fragments with dimension tags supports accumulation without coherence loss.

2.  **Contracts catch breaks:** TypeScript contracts at data boundaries catch breaking changes during rapid iteration with minimal overhead.

3.  **Incremental synthesis viable:** New knowledge can be merged into existing synthesis without full reprocessing, though quality monitoring needed.

4.  **Source linking essential:** Users need to trace generated insight back to source. Data architecture must preserve this lineage.

## Why This is R&D (Not Standard Data Modelling)

Standard data modelling applies known patterns to known domains. A3 addresses research questions: How should strategic knowledge be decomposed? (No prior work). Can fragments maintain coherence as they accumulate? (Uncertain outcome). What synthesis algorithms preserve quality? (Novel algorithms required). The fragment/synthesis architecture is a hypothesis about knowledge representation, not an application of established patterns.

## Expenditure Allocation

Estimated **15%** of total R&D time allocated to A3 activities.
