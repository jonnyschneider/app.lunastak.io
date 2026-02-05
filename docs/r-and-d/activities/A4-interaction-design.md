# Activity A4: Interaction Design & Cold Start

**Activity Code:** A4
**Type:** Core R&D Activity
**Period:** December 2025 - Ongoing

---

## Unknown Outcome

Whether users can be guided to provide sufficient quality and quantity of strategic input through digital interaction, given that strategic thinking is typically elicited through high-touch human facilitation.

**Specific unknowns:**
1. What input modalities (conversation, document upload, voice, copy/paste) produce the richest strategic signal?
2. How much guidance is needed vs. letting users explore freely?
3. Can progressive disclosure reduce overwhelm without hiding critical information?
4. What "cold start" approaches get users past the blank page problem?
5. How should generated insight be organised for navigation and trust-building?

---

## Why Existing Knowledge is Insufficient

1. **Novel interaction model:** Traditional strategy consulting relies on human rapport, body language, and real-time calibration. Digital-first strategic elicitation has no established patterns.

2. **Input quality dependency:** The core A1 hypothesis (can LLM generate quality strategy?) cannot be tested if users don't provide quality input. Interaction design directly gates research validity.

3. **Overwhelm risk:** LLM systems can generate vast amounts of content. How to present this without overwhelming users—while maintaining trust—is unexplored in strategy domains.

4. **Cold start is domain-specific:** Generic onboarding patterns don't apply when the "task" is introspection about business strategy.

---

## Systematic Work Conducted

### 1. Entry Point Experimentation (v1.2.0)

**Challenge:** Users face blank page paralysis when asked to "talk about their business"

**Approaches tested:**
- Guided Conversation (live) - Traditional Q&A flow
- Upload Document (live) - Extract from existing artefacts
- Start from Canvas (fake door) - Visual strategy builder
- Fast Track (fake door) - Quick multiple choice

**Outcome:** Document upload showed promise; fake doors validated interest in alternative modalities

**Evidence:** v1.2.0 CHANGELOG, event tracking for `entry_point_selected`

### 2. Project-Centric Navigation (v1.5.0-v1.6.0)

**Challenge:** Multi-session work creates navigation complexity

**Approaches tested:**
- Flat conversation list vs. project containers
- Starring/favouriting for quick access
- Deep dive sheets for focused exploration

**Outcome:** Project containers reduced cognitive load; deep dives enabled focused exploration without losing context

**Evidence:** v1.5.0, v1.6.0 CHANGELOG entries

### 3. Progressive Disclosure (v1.7.2)

**Challenge:** Dashboard showing everything at once overwhelmed users

**Approaches tested:**
- Collapsed "Luna's Memory" header with expand
- Limited provocations (3 items + "show more")
- Tabbed views for strategy content

**Outcome:** Significant reduction in reported overwhelm; users engage more deeply with less visible content

**Evidence:** v1.7.2 CHANGELOG, dogfooding observations

### 4. Information Architecture Iterations (v1.5.2, v1.6.1, v1.7.4)

**Challenge:** Where does each type of content belong?

**Work conducted:**
- Empty state design for new projects
- Section reordering based on user priority
- Strategy history submenu for version access
- Deep dive topic linking for context preservation

**Evidence:** Multiple CHANGELOG entries documenting restructuring rationale

### 5. Trust & Attribution (v1.7.0, v1.7.4)

**Challenge:** Users question "is this mine?" and "where did this come from?"

**Approaches tested:**
- Structured provocations with title + description
- Topic linking showing conversation source
- "Part of" indicators in chat list

**Outcome:** Explicit attribution reduced distrust; users more willing to engage with generated content

**Evidence:** v1.7.0, v1.7.4 CHANGELOG entries

---

## New Knowledge Generated

### Validated Findings

1. **Multiple entry points matter:** Different users prefer different starting modalities. Document upload captures users who won't type; conversation captures those who think out loud.

2. **Progressive disclosure works:** Hiding complexity behind expandable sections increases engagement depth without sacrificing discoverability.

3. **Attribution builds trust:** Showing where insights came from ("from your conversation about X") significantly increases user trust in generated content.

4. **Project containers scale:** Multi-session work requires explicit grouping; flat lists become unnavigable quickly.

### Pending Validation

- Voice input effectiveness (planned)
- Optimal question depth before fatigue
- Canvas/visual input modalities
- Mobile-first interaction patterns

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Entry Points | v1.2.0 CHANGELOG | Four modality experiment |
| Navigation | v1.5.0-v1.6.0 CHANGELOG | Project-centric restructure |
| Progressive Disclosure | v1.7.2 CHANGELOG | Dashboard redesign |
| Event Tracking | Statsig | `entry_point_selected`, navigation events |
| Fake Door Results | Internal notes | Canvas/Fast Track interest validation |

---

## Expenditure Allocation

Estimated **15%** of total R&D time allocated to A4 activities:
- Entry point design and implementation
- Navigation architecture iterations
- Progressive disclosure implementation
- Information architecture restructuring
- User flow optimisation

---

## Relationship to Other Activities

- **A1 (Judgement Engine):** A4 determines whether users provide sufficient input for A1 to function
- **A2 (Evaluation & Observability):** A4 decisions are measured through A2 instrumentation
- **A5 (Performance):** A4 designs must account for A5 constraints (loading states, async feedback)

---

## Why This is R&D (Not Standard UX)

Standard UX optimises for known goals (conversion, engagement). A4 addresses a research question: *can digital interaction elicit strategic input at all?*

If users cannot provide quality input through any modality, the core A1 hypothesis is disconfirmed. A4 is not optimisation—it's determining whether the fundamental interaction model is viable.
