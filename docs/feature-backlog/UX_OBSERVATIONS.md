# UX Observations & Issues

**Purpose:** Track user experience issues, friction points, and feature ideas discovered during testing and real usage. These inform prioritization for future iterations.

**Format:** Each observation includes date, context, issue/insight, and potential solution ideas.

---

## Session: 2025-12-07 - First Complete Flow Test

**Tester:** Jonny
**Test Method:** Used LLM to simulate associate director speaking with management consultants
**Completion:** Full conversation → extraction → strategy generation ✅

### Observation 1: Dynamic Questions Feel Natural ✅

**Category:** Positive / Keep
**What happened:** The AI's ability to play back understanding and extend with connected follow-up questions created a natural, consultant-like dialogue.

**Quote/Example:** "The dynamic questions (building upon the last) felt natural and engaging. Just like speaking with a consultant."

**Insight:** The conversational pattern is working as intended. The "listen, reflect, extend" pattern creates engagement and feels professional.

**Action:** Keep this pattern. Consider this a core strength to preserve in future iterations.

---

### Observation 2: Users Need to Share Complex Structured Data 🔴

**Category:** Issue / Feature Gap
**Severity:** Medium-High
**What happened:** By question 2, the simulated user needed to share a detailed table of target user types. This would be impractical to type conversationally.

**Quote/Example:** "A detailed table of target user types was given. That would be impractical to type out conversationally."

**User Pain Points:**
- Typing tables/lists in conversational format is awkward
- Structured data (segments, personas, feature matrices) common in business strategy
- Copy-pasting from existing docs would be natural but current UI doesn't support well

**Potential Solutions:**

1. **Document Upload with Extraction**
   - Technical: Use docling or similar for PDF/spreadsheet extraction
   - User guidance challenge: What document types are actually useful?
   - Question framing: How to subtly guide users toward relevant artefacts without being prescriptive?
   - Token management: Large documents could be expensive - need summarization or selective extraction strategy

2. **Guided Artefact Prompts**
   - Reframe questions to suggest document types: "Do you have a market analysis or customer segmentation you could share?"
   - Provide examples of useful artefacts: "Things like persona documents, competitive analyses, or business plans can help"
   - Progressive disclosure: Only suggest upload when contextually relevant

3. **Selective Document Processing**
   - Instead of processing entire document, ask user: "What section is most relevant?"
   - Use chunking + semantic search to extract only relevant portions
   - Show token cost preview before processing large docs

4. **Structured Input Toggle**
   - Switch between conversational and form-based input mid-conversation
   - "Paste a table" mode with better formatting support
   - Rich text editor for lists, tables, bullet points

5. **Post-Conversation Attachment**
   - After 3 questions, offer: "Have any documents you'd like to add before we analyze?"
   - Optional enrichment step before extraction phase
   - Avoids interrupting conversational flow

**Open Questions:**
- What are the most common business artefacts users would want to reference?
  - Market research reports, competitor analyses, business plans, customer data, financial projections?
- How do we balance conversational flow vs. comprehensive data gathering?
- Should document upload be proactive (suggested) or reactive (only when user struggles)?
- What's the token budget per conversation? (affects document size limits)
- Can we use document presence as a quality signal for better strategy generation?

**Priority Assessment:**
- **Impact:** High (blocks natural information sharing)
- **Frequency:** Likely very common in B2B strategy discussions
- **Complexity:** Medium-High (technical easy, UX guidance hard)
- **Workaround:** Users can paste poorly formatted tables, but creates friction
- **Phase:** Consider for Phase 1.5 or Phase 2
- **Dependencies:** Need to understand common use cases first (collect more data in Phase 1)

**Research Needed:**
- Interview early users about what documents they naturally reference during strategy discussions
- Track how often users paste large blocks of structured data
- Analyze what types of information extraction struggles with in conversational format

**Related Features:**
- Document parsing (extract info from PDFs, spreadsheets)
- Multi-modal input (text + attachments)
- Context enrichment before strategy generation
- Smart summarization for large documents
- Semantic search within uploaded docs

---

### Observation 3: ReactFlow Visualization Needs Interactivity 🔴

**Category:** Issue / UI Polish
**Severity:** Medium
**What happened:** The strategy visualization displays but lacks interactive features needed for different output shapes and exploration.

**Quote/Example:** "The react flow visualisation needs work. It's fine for Alpha, but I think we'll need something that is more interactive, and capable of fitting different shaped outputs into."

**Current Limitations:**
- Static display only
- Fixed layout may not accommodate varying strategy structures
- No expand/collapse functionality for complex nodes
- Limited adaptability to different output formats

**Potential Solutions:**
1. **Expand/Collapse Nodes** - Allow users to drill into detailed sections or collapse for overview
2. **Flexible Layout Engine** - Auto-adapt to different strategy shapes (linear, hierarchical, networked)
3. **Interactive Exploration** - Click to focus, zoom, pan, highlight connections
4. **Export Options** - Different views for different purposes (presentation mode, detailed analysis)
5. **Progressive Disclosure** - Start with high-level, expand to detail on demand

**Priority Assessment:**
- **Impact:** Medium (doesn't block usage, but affects perceived value)
- **Frequency:** Every strategy generation
- **Complexity:** Medium (ReactFlow supports this, needs design + implementation)
- **Phase:** Phase 2 (after we understand variety of output formats)
- **Dependencies:** Need to see range of actual strategy outputs first

---

### Observation 4: Conversational Tone Matching Can Be Too Intense 🟡

**Category:** Issue / AI Behavior
**Severity:** Medium
**What happened:** The AI mirrored the formal, knowledgeable tone of the input, going deep quickly. This could intimidate users who need more gentle onboarding.

**Quote/Example:** "The conversation went deep very quickly. There might need to be a bit more 'foreplay'... inputs were formal and a bit 'knowitallsy', and so the responses matched with similar implied knowledge/understanding."

**User Pain Points:**
- Tone matching is good for rapport, but can amplify intimidating language
- Assuming too much knowledge creates anxiety
- Deep, difficult questions early may overwhelm users
- Users with less business experience may feel inadequate

**The Challenge:**
- We want AI to match user style (good rapport)
- But we don't want to match complexity/formality that intimidates
- Need to calibrate toward accessible, supportive tone regardless of input style

**Potential Solutions:**
1. **Tone Calibration in Prompts**
   - Explicitly instruct AI to stay warm and accessible even if user is formal
   - "Match enthusiasm, not complexity"
   - Progressive deepening only when user demonstrates comfort

2. **Onboarding Context Setting**
   - Brief intro that sets expectations: "I'll ask simple questions to understand your business"
   - Reduce anxiety by being explicit about simplicity
   - "No wrong answers, just thinking out loud together"

3. **Difficulty Adaptation**
   - Start simple regardless of first response
   - Only increase depth if user responses show sophistication
   - Detect uncertainty signals in responses (hedging, short answers, "I'm not sure")

4. **User Preference Setting**
   - Optional: "How would you like me to approach this? (Quick & Direct / Exploratory & Gentle)"
   - Remember preference for returning users

**Open Questions:**
- How do we detect when a user is struggling vs. just being concise?
- Is there a "goldilocks zone" of question depth that works for most users?
- Should we always err on the side of simpler questions?
- Can we A/B test different tone calibrations in Phase 1?

**Priority Assessment:**
- **Impact:** High (affects user comfort and willingness to engage)
- **Frequency:** First-time users especially vulnerable
- **Complexity:** Medium (prompt engineering + testing)
- **Phase:** Phase 1.5 (after collecting data on user comfort levels)
- **Dependencies:** Need real user feedback on tone/depth perception

**Research Needed:**
- Survey users after conversation: "Did questions feel appropriate for your level?"
- Track dropout rates by question depth/complexity
- A/B test different tone calibration prompts

---

### Observation 5: Three Questions Insufficient for Quality Output 🔴

**Category:** Core Product / Strategy Quality
**Severity:** High
**What happened:** While strategy output was reasonable given inputs, 3 questions isn't enough depth to create impressive, high-value strategies.

**Quote/Example:** "It's pretty clear that 3 questions isn't really enough to develop a useful strategy... it's reasonable given the inputs, but it's not going to 'wow' anyone."

**The Trade-off:**
- Shorter conversations = lower barrier to completion (good for data collection)
- Longer conversations = better quality outputs (good for user value)
- Current 3-question approach optimizes for completion, not value

**Potential Approaches to Test:**

1. **Straight to Business (3-5 detailed questions)**
   - Pros: Efficient, respects user time, gets to value quickly
   - Cons: May feel transactional, misses nuance, intimidating
   - Best for: Time-pressed executives, repeat users

2. **Gentle Exploration (8-12 informal questions)**
   - Pros: Builds rapport, uncovers hidden insights, feels supportive
   - Cons: Time-intensive, may lose user attention, harder to track progress
   - Best for: First-time users, complex situations, exploratory discussions

3. **Hybrid Progressive Depth**
   - Start with 3 broad questions (current approach)
   - After extraction, show preview and offer: "Want to go deeper on any area?"
   - Allow selective deepening based on user interest
   - Pros: Flexible, user-controlled, balances efficiency and depth
   - Cons: More complex UX, unclear stopping point

4. **Adaptive Question Count**
   - AI determines question count based on:
     - Response quality/detail (detailed answers = fewer questions needed)
     - Clarity of extracted context (confidence level)
     - User engagement signals
   - Continue until confidence threshold reached
   - Pros: Optimizes for quality, not arbitrary number
   - Cons: Unpredictable duration, harder to set expectations

**Open Questions:**
- What's the minimum number of questions to generate impressive strategies?
- Does quality scale linearly with question count, or diminishing returns?
- How do we balance completion rate vs. output quality?
- Can we offer different "paths" for different user preferences?
- Should question count vary by business complexity/type?

**User Preference Variability:**
- Some users want quick, actionable output
- Others want deep, comprehensive analysis
- Same user may want different approaches for different projects
- Need flexibility, not one-size-fits-all

**Priority Assessment:**
- **Impact:** CRITICAL (affects core value proposition)
- **Frequency:** Every conversation
- **Complexity:** High (affects entire conversation flow, extraction, generation)
- **Phase:** Phase 1 (need to test variations NOW to collect comparative data)
- **Dependencies:** This IS the product - must solve early

**Testing Strategy:**
- A/B test different question counts in Phase 1
- Track both completion rates AND user satisfaction
- Measure correlation between question count and strategy quality
- Survey users: "Would you have preferred more/fewer questions?"
- Qualitative feedback: "Did the strategy feel comprehensive enough?"

**Critical Decision Needed:**
We need to decide soon whether to:
- Keep 3 questions for Phase 1 to maximize data collection, accept lower quality
- OR increase to 5-7 questions to improve quality, risk fewer completions
- OR test multiple variations simultaneously (requires more complex infrastructure)

---

## Analysis & Patterns

### Emerging Themes
1. **Conversational flow works well** - Natural dialogue pattern is effective (Obs 1)
2. **Information input format mismatch** - Business info often exists in structured formats (Obs 2)
3. **Quality vs. Efficiency tension** - 3 questions completes fast but lacks depth (Obs 5)
4. **Tone calibration challenge** - Matching user style can amplify intimidation (Obs 4)
5. **Output presentation matters** - Visualization needs work to support variety of strategies (Obs 3)

### Critical vs. Polish Issues

**Critical (Affects Core Value):**
- Observation 5: Three questions insufficient ⚠️ **NEEDS DECISION**
- Observation 2: Structured data input (after Phase 1 data collection)

**Important (Affects Experience):**
- Observation 4: Tone matching intensity (prompt engineering opportunity)

**Polish (Affects Perception):**
- Observation 3: ReactFlow interactivity (Phase 2)

### Questions to Explore
- What percentage of users will want to share structured data?
- Should we maintain conversational purity or add practical data input?
- Can we detect when users struggle with format and offer alternatives?

---

## Next Steps

1. Continue testing with different user scenarios
2. Track how often structured data issue appears
3. Prototype "attach document" flow if pattern persists
4. Test with real users (not LLM simulation) to validate

---

## Strategic Considerations & Feature Backlog

### Adaptive Conversation Length Strategy

**Concept:** Question count should adapt based on indicator quality and domain complexity, not be fixed.

**Key Insights:**
- Different scenarios require different indicator densities:
  - **Few high-quality indicators** may be sufficient in some cases (e.g., well-defined product with clear market)
  - **Many lower-confidence indicators** may be needed in complex/ambiguous domains (e.g., novel markets, complex B2B)
- Variability factors:
  - Domain/industry complexity
  - Product type (B2B vs B2C, physical vs digital, etc.)
  - Customer segment clarity
  - Business maturity stage

**Implication:** Need to develop "confidence threshold" model that determines when we have enough quality indicators for a meaningful decision stack, rather than arbitrary question counts.

**Research Questions:**
- What constitutes a "high-quality indicator"? (specificity, clarity, confidence)
- Can we measure indicator quality in real-time during conversation?
- What's the minimum viable indicator set per domain type?
- How do we communicate progress toward "enough information" to users?

**Potential Implementation:**
- Real-time confidence scoring during conversation
- Domain-specific indicator requirements
- Visual progress indicator showing "information completeness"
- Continue conversation until threshold met (with reasonable max/min bounds)

---

### Participant-Led Conversation Framing

**Concept:** Give users choice in how they want to approach the strategy conversation, respecting their mental models and preferences.

**Key Insights:**
- Different participants naturally think through different lenses:
  - **Customer experience perspective** - user-centric thinkers
  - **Business strategy & operations** - MBA/consultant types
  - **Competitive positioning** - market-oriented founders
  - **Product/technology** - technical founders
  - **Financial/metrics** - analytical/data-driven leaders
- Same participant might want different approaches for different projects
- Guided pathways can help familiarize new users while respecting expertise

**User Experience Flow:**
After initial context, offer framing choice:
> "How would you like to think through your strategy?"
> - Start with your customers (who they are, what they need)
> - Start with your business model (how you create and capture value)
> - Start with your market position (competitors, differentiation)
> - Start with your product (features, capabilities, roadmap)
> - Let me guide you (AI chooses adaptive path)

**Benefits:**
- Respects user's natural thinking style
- Reduces cognitive friction
- Allows users to start from their strength/confidence area
- Educational - helps users understand different strategic lenses
- Personalization without overwhelming

**Implementation Considerations:**
- Each pathway leads to comprehensive coverage, just different order/emphasis
- Pathways converge to same indicator requirements
- Track which pathways work best for which user types
- Allow pathway switching mid-conversation if user gets stuck

**Research Questions:**
- What are the most common natural mental models for strategy?
- Do certain pathways produce higher quality indicators?
- Should we recommend pathways based on industry/role signals?
- Can we detect when a user chose the "wrong" pathway and suggest switching?

---

**Last Updated:** 2025-12-07
**Total Observations:** 5 core observations + 2 strategic concepts
**Status:** Active research and testing phase
