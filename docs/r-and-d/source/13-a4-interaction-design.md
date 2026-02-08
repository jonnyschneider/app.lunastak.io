# 13. Area of Focus: Interaction Design & Cold Start

  -----------------------------------------------------------------------
  **Activity Code**      A4
  ---------------------- ------------------------------------------------
  **Type**               Core R&D Activity

  **Period**             December 2025 - Ongoing
  -----------------------------------------------------------------------

## Unknown Outcome

Whether users can be guided to provide sufficient quality and quantity of strategic input through digital interaction, given that strategic thinking is typically elicited through high-touch human facilitation.

**Specific unknowns:**

+--------------------------------------------------------------------------------------------------------------------+
| > *What input modalities (conversation, document upload, voice, copy/paste) produce the richest strategic signal?* |
+--------------------------------------------------------------------------------------------------------------------+
| > *How much guidance is needed vs. letting users explore freely?*                                                  |
+--------------------------------------------------------------------------------------------------------------------+
| > *Can progressive disclosure reduce overwhelm without hiding critical information?*                               |
+--------------------------------------------------------------------------------------------------------------------+
| > *What \"cold start\" approaches get users past the blank page problem?*                                          |
+--------------------------------------------------------------------------------------------------------------------+
| > *How should generated insight be organised for navigation and trust-building?*                                   |
+====================================================================================================================+

## Systematic Work Conducted

### 1. Entry Point Experimentation (v1.2.0)

Tested: Guided Conversation (live), Upload Document (live), Start from Canvas (fake door), Fast Track (fake door). Document upload showed promise; fake doors validated interest in alternative modalities.

### 2. Project-Centric Navigation (v1.5.0-v1.6.0)

Tested flat conversation list vs. project containers, starring/favouriting for quick access, deep dive sheets for focused exploration. Project containers reduced cognitive load.

### 3. Progressive Disclosure (v1.7.2)

Collapsed \"Luna\'s Memory\" header with expand, limited provocations (3 items + \"show more\"), tabbed views. Significant reduction in reported overwhelm.

### 4. First-Time Experience Recovery (2026-02-08)

**Challenge:** Users starting first-time conversations who leave before completing break the experience when returning - conversation resumes in wrong context with broken UI.

**Uncertainty:** How do we handle interrupted first-time user journeys without losing context or breaking the experience?

**Approach:** Explicit `isInitialConversation` flag to track first-strategy conversations, resume in correct UI context (InlineChat vs ChatSheet), extraction boundary tracking for resumed conversations.

**Evidence:** docs/plans/2026-02-08-first-time-experience-design.md

### 5. Decision Stack Editing & Completion (2026-02-09)

**Challenge:** Generated Decision Stacks are read-only outputs. Users cannot refine, correct, or complete them without starting new conversations.

**Uncertainty:** What editing modalities (inline, modal, conversational coaching) work best for different Decision Stack components? Can "template-first" entry (user fills in strategy, AI learns from it) overcome cold start friction?

**Approach:** Three-tier editing model: inline deterministic for Vision/Strategy, unique trade-off UX for Principles, side sheet coaching conversations for deeper refinement. Silent versioning captures history without UI complexity. Template-first cold start inverts the conversation→strategy flow.

**Evidence:** docs/plans/2026-02-09-decision-stack-editing-design.md

## New Knowledge Generated

1.  **Multiple entry points matter:** Different users prefer different starting modalities. Document upload captures users who won\'t type; conversation captures those who think out loud.

2.  **Progressive disclosure works:** Hiding complexity behind expandable sections increases engagement depth without sacrificing discoverability.

3.  **Attribution builds trust:** Showing where insights came from (\"from your conversation about X\") significantly increases user trust in generated content.

4.  **Project containers scale:** Multi-session work requires explicit grouping; flat lists become unnavigable quickly.

## Why This is R&D (Not Standard UX)

Standard UX optimises for known goals (conversion, engagement). A4 addresses a research question: can digital interaction elicit strategic input at all? If users cannot provide quality input through any modality, the core A1 hypothesis is disconfirmed. A4 is not optimisation---it\'s determining whether the fundamental interaction model is viable.

## Expenditure Allocation

Estimated **15%** of total R&D time allocated to A4 activities.
