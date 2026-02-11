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

### 6. Embedded Coaching Patterns (2026-02-10)

**Challenge:** Strategy coaching guidance was hidden behind info icons that users rarely clicked. Critical best-practice tips were invisible during the editing experience.

**Uncertainty:** How do we surface coaching without being intrusive? Can guidance be present but not demanding?

**Approach:** Click-to-edit pattern with coaching callouts that appear only during editing. Subtle warm styling (amber/beige left-border, italic text) creates "aside" quality. No dismissal needed - coaching naturally disappears when editing ends.

**Evidence:** Implemented in InlineTextEditor, ObjectiveInlineEditor components.

### 7. Socratic Principles Input (2026-02-10)

**Challenge:** Curated trade-off selections felt "spoon-feedy" and didn't capture authentic user priorities. Pre-defined options limited expression.

**Uncertainty:** Can LLM-powered suggestion create a more natural "even/over" principle capture? Will users engage with open-ended input?

**Approach:** Socratic flow: ask "what matters most?", user types freely, LLM suggests opposite, user edits and confirms. Vertical stacked chip display with flip/remove actions.

**Evidence:** PrinciplesSection.tsx, /api/suggest-opposite endpoint.

### 8. Simplified OMTM for Intent, Not Measurement (2026-02-11)

**Challenge:** Initial OMTM design (baseline→target→timeframe) created confusion - users specified "from X to Y" at both Objective level AND Opportunity level. The cognitive overhead undermined the simplicity goal.

**Uncertainty:** Can we separate "intent" (what metric matters) from "measurement" (specific targets) to reduce cognitive load while maintaining strategic rigour?

**Approach:** OMTM on Objectives simplified to metric name + optional aspiration text (e.g., "Weekly Active Users" + "Significant growth"). No baseline/target/timeframe on Objectives. All rigorous measurement ("from X to Y") lives on Opportunities as hypothesis-driven success metrics. This positions Objectives as alignment signals for ICs, while Opportunities drive testable initiative validation.

**Evidence:** docs/plans/2026-02-11-opportunities-okr-redesign.md

### 9. OAuth for Frictionless Return Visits (2026-02-11)

**Challenge:** Magic link authentication requires users to check email on every return visit, creating friction that undermines the "longitudinal coach" value proposition.

**Uncertainty:** Can reducing return-visit friction (magic link → OAuth) improve retention for a product that depends on multi-session engagement?

**Approach:** Google OAuth as primary sign-in with magic link fallback. Provider array structure for future Microsoft OAuth. UI design prioritizes OAuth while keeping magic link visible for users who need it.

**Evidence:** docs/plans/2026-02-11-google-oauth-design.md

## New Knowledge Generated

1.  **Multiple entry points matter:** Different users prefer different starting modalities. Document upload captures users who won\'t type; conversation captures those who think out loud.

2.  **Progressive disclosure works:** Hiding complexity behind expandable sections increases engagement depth without sacrificing discoverability.

3.  **Attribution builds trust:** Showing where insights came from (\"from your conversation about X\") significantly increases user trust in generated content.

4.  **Project containers scale:** Multi-session work requires explicit grouping; flat lists become unnavigable quickly.

## Why This is R&D (Not Standard UX)

Standard UX optimises for known goals (conversion, engagement). A4 addresses a research question: can digital interaction elicit strategic input at all? If users cannot provide quality input through any modality, the core A1 hypothesis is disconfirmed. A4 is not optimisation---it\'s determining whether the fundamental interaction model is viable.

## Expenditure Allocation

Estimated **15%** of total R&D time allocated to A4 activities.
