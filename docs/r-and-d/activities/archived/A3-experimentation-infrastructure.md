# Activity A3: Systematic Experimentation Infrastructure

**Activity Code:** A3
**Type:** Supporting R&D Activity
**Period:** December 2025 - Ongoing

---

## Unknown Outcome

Whether robust experimentation infrastructure can be built to enable rigorous A/B testing of LLM-based strategic systems in a serverless environment, while maintaining data integrity and supporting continuous deployment.

**Specific unknowns:**
1. Can A/B experiments run reliably in serverless (Vercel) without race conditions?
2. Do TypeScript contracts at data boundaries catch breaking changes without excessive overhead?
3. Can fragment-based architecture support continuous knowledge accumulation across sessions?
4. What verification gates are necessary to maintain quality during rapid iteration?

**[Review]** Good questions. 3 is the monster amoung them. And is really what's driven the development work on the core in recent weeks (and for weeks to come yet). Good spot to interweave the UX thing again... One of the major learning moments behind this is speed and perforamanc  really matters. The product experience "locks out" users while lengthy and complicated API calls process serially. This influenced some signficant architectural changes (`fire and forget` processing, `parallelisation` of API calls, and `incremental extraction` in recent weeks). These are driving significant technical/engineering efforts,  because we recognise that users aren't particularly willing to spend their scarce time with waiting for a janky prototype to load very slowly. 

Another candidate question here is related to `multi-session complexity` that is mentioned. Initial efforts (early prototype) were setup around trying to prove out that it's possible to produce a decent result from a 1 single and continuous conversation... But of course, this is cpompletelY unrealistic. Nobody (excpet maybe myself!) is willing to sit at conversation prompt and respond to these esoteric questions with I multi-paragraph responses, "sitting through" the discomfort of uncerainty. A hypothesis is that the system accomodate this, but enabling the "scrappy and bitty" nature of how this work happens. Yes, we can prove that decent strategic artefacts and reasoning can be done by LLM when eveything fits neatly within one continuous conversation in a single context window. But the million dollar question is: Can we, when understanding is ephemeral and always changing, and inputs wax and wane in importance and focus, depending on 1,000 other htings going on. Can LLM meaningfully navigate through this with the user in a way that is constructive?

**[Review]** The rest of this doc from here is similar to the other two. Clear to me we need to work on narrative for bit here, and come back to it. 
Aside from this, I think the overall structure, document format and length is pretty good, and hits the right balance. A big risk here is unconsciously overcooking it, either because my thinking isn't clear enough, or I don' thave time to wrestle verbose explainations across many sources into somthing coherent. 

---

## Why Existing Knowledge is Insufficient

1. **Serverless constraints:** Traditional A/B testing assumes persistent processes; serverless functions have cold starts, timeouts, and no shared state.

2. **LLM output variability:** Unlike deterministic systems, LLM outputs vary—experimentation infrastructure must account for this variance.

3. **Schema evolution:** Rapid experimentation requires frequent schema changes; standard approaches don't provide sufficient safety for experimental systems.

4. **Multi-session complexity:** Knowledge accumulation across sessions creates state management challenges not addressed by standard web architectures.

---

## Systematic Work Conducted

### 1. A/B Testing Infrastructure (Statsig Integration)

**Challenge:** Enable controlled experiments across extraction/generation approaches

**Solution developed:**
- Statsig SDK integration for feature flags and experiments
- Migration from feature gates to proper experiments (variant assignment)
- Custom event logging (dimensional_coverage, quality_rating, strategy_generated)
- Variant tagging on all conversations for analysis

**Evidence:** v1.1.0, v1.4.2 CHANGELOG entries; `src/lib/statsig.ts`

### 2. Contract-Driven Quality System

**Challenge:** Prevent breaking changes during rapid experimentation

**Solution developed:**
- TypeScript contracts at extraction/persistence/generation boundaries
- Contract validation tests (extraction, persistence, generation)
- Smoke tests for critical path verification
- Pre-push hook enforcing `npm run verify`

**Outcome:** Contracts caught multiple breaking changes during E3 development

**Evidence:** v1.4.4 CHANGELOG; `src/lib/contracts/README.md`

### 3. Fragment-Based Knowledge Architecture

**Challenge:** Enable knowledge to accumulate across multiple sessions

**Solution developed:**
- Fragment model (discrete pieces of strategic insight)
- FragmentDimensionTag for dimensional mapping
- DimensionalSynthesis for compressed understanding per dimension
- Incremental vs full synthesis algorithms

**Evidence:** v1.4.0 CHANGELOG; `src/lib/fragments.ts`, `src/lib/synthesis/`

### 4. Serverless Reliability Patterns

**Challenge:** Async operations fail silently in serverless

**Solutions developed:**
- Fire-and-forget elimination (await all operations)
- Neon serverless adapter for cold start connection reliability
- Explicit Statsig flush before response completion
- Timeout configuration for Claude API calls

**Evidence:** v1.5.1, v1.7.3 CHANGELOG entries; documented in ARCHITECTURE.md as "Known Compromises"

### 5. Guest User Isolation

**Challenge:** Track experiment data for unauthenticated users

**Solution developed:**
- Guest users create real User + Project records
- Full fragment/extraction tracking for all users
- Session transfer merges data on authentication

**Evidence:** v1.4.0 CHANGELOG; `src/lib/projects.ts`

---

## New Knowledge Generated

### Validated Findings

1. **Contracts work at scale:** TypeScript contracts at data boundaries catch breaking changes during rapid iteration with minimal overhead.

2. **Serverless requires explicit completion:** All async operations must be awaited; fire-and-forget patterns fail silently.

3. **Fragment architecture enables accumulation:** Discrete fragments with dimension tags support multi-session knowledge building.

4. **Cold start mitigation:** Neon serverless adapter eliminates connection errors on cold starts.

### Documented Compromises

| Compromise | Status | Rationale |
|------------|--------|-----------|
| Sequential synthesis (slow) | Okay for now | Parallelisation adds complexity |
| Window events for cross-component state | Okay for now | Proper state management deferred |
| Guest-to-auth duplicate handling | Durable | Cascade delete on empty projects |

---

## Evidence References

| Evidence Type | Location | Description |
|---------------|----------|-------------|
| Contract Documentation | `src/lib/contracts/README.md` | Contract system explanation |
| Contract Tests | `src/lib/__tests__/contracts/*.test.ts` | Validation test suites |
| Smoke Tests | `src/lib/__tests__/smoke.test.ts` | Critical path verification |
| Architecture Doc | `docs/ARCHITECTURE.md` | Known compromises, patterns |
| Statsig Guide | `docs/STATSIG_EXPERIMENTS.md` | Experiment setup guide |
| Fragment Service | `src/lib/fragments.ts` | Fragment creation/retrieval |
| Synthesis Algorithms | `src/lib/synthesis/*.ts` | Full/incremental synthesis |

---

## Expenditure Allocation

Estimated **20%** of total R&D time allocated to A3 activities:
- Statsig SDK integration and experiment configuration
- Contract system design and implementation
- Test infrastructure (contract tests, smoke tests)
- Fragment and synthesis architecture
- Serverless reliability patterns
- Pre-push verification system

---

## Relationship to Other Activities

- **A1 (Judgement Engine):** A3 provides infrastructure to run A1 experiments
- **A2 (Evaluation Framework):** A3 captures metrics that A2 defines
- **Direct support:** A3 is a supporting activity directly enabling A1 and A2 core R&D
