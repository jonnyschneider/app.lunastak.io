# Lunastak Technical Diligence Briefing

**Version:** 1.7.3 (Beta)  
**Date:** 26 January 2026  
**Prepared for:** Investor Technical Review

---

## Executive Summary

Lunastak is an AI-powered strategic planning application that solves the "cold start problem" in strategy development. Rather than forcing executives to fill blank templates, Lunastak captures strategic insights wherever they occur—through conversational AI, voice memos, documents, and meetings—then synthesises them into structured strategic outputs using a validated 11-dimension framework.

**Key Metrics:**
- **Codebase maturity:** Production beta (v1.7.3)
- **Development velocity:** 7 major releases since December 2025
- **Architecture:** Modern serverless stack (Next.js 14, Vercel, Postgres)
- **Testing coverage:** 55 passing tests including contracts, smoke tests, and integration tests
- **Documentation:** Comprehensive (architecture, experiments, deployment guides)

---

## 1. Product Overview & Strategy

### The Problem: Strategy Development is Broken

Executives develop strategic insights in fragmented ways:
- Voice memos during car rides
- Scattered notes from meetings
- Conversations with advisers
- Random moments of clarity

But when asked "what is your strategy?", they face a blank page. Traditional tools demand structured input upfront, creating friction and filtering out valuable thinking that doesn't fit the mould.

### How Lunastak Solves It

Lunastak inverts the process:

1. **Capture:** Accept input in any format (conversation, documents, voice memos)
2. **Structure:** Map unstructured thinking to 11 strategic dimensions
3. **Synthesise:** Build coherent strategic understanding continuously
4. **Generate:** Produce Decision Stack outputs (Vision → Strategy → Objectives)

**Core insight:** The structure is Lunastak's job. Thinking is the user's job.

### Strategic Framework: The 11 Dimensions

Lunastak synthesises the best strategic frameworks (Porter, Lafley/Martin, Rumelt, Helmer, Christensen) into a unified lens:

1. **Customer & Market** – Who you serve, their problems, buying behaviour
2. **Problem & Opportunity** – Why this matters, why now, how big
3. **Value Proposition** – What you offer, why it matters
4. **Differentiation & Advantage** – What makes you unique, your moats
5. **Competitive Landscape** – Who else plays, positioning
6. **Business Model & Economics** – How you make money, unit economics
7. **Go-to-Market** – How you reach and retain customers
8. **Product Experience** – The experience you're creating
9. **Capabilities & Assets** – What you can do, what you have
10. **Risks & Constraints** – What could go wrong, dependencies
11. **Strategic Intent** – Raw aspirational statements

These dimensions aren't arbitrary—they represent the essential questions any rigorous strategy must answer.

### Output: The Decision Stack

Lunastak generates strategy using the Decision Stack framework:
- **Vision:** Aspirational future state (3-5 year horizon)
- **Strategy:** Coherent choices about where to play and how to win
- **Objectives:** SMART goals with metrics (timeframe, direction, targets)

This framework comes from established strategy literature and is used by companies like Google.

### Target Market

**Primary:** Growth-stage SaaS companies (Series A-C)
- Founder/CEO + executive team
- Need strategic clarity but lack dedicated strategy resources
- Time-poor executives who can't commit to lengthy facilitated workshops

**Use cases:**
1. **Pre-work for strategy sessions:** Elevate baseline before facilitated workshops
2. **Continuous strategic development:** Replace episodic planning with ongoing capture
3. **Board/investor reporting:** Generate crisp strategic narratives on demand

### Business Model

**Two interconnected businesses:**

1. **Lunastak (Product):** SaaS subscription for strategy development
   - Self-serve product for executives
   - Pricing TBD (currently in beta validation)

2. **Humble Ventures (Services):** Strategy facilitation consulting
   - Workshop facilitation for strategy development
   - Lunastak serves as pre-work tool
   - Dual revenue streams: consulting + software

**Strategic rationale:** Product-service hybrid creates:
- **Better product:** Consulting informs product development through real usage
- **Better consulting:** Software elevates workshop quality
- **Risk mitigation:** Multiple revenue streams
- **Market validation:** Consulting validates customer needs

### Competitive Positioning

**Primary competition:** Blank templates and facilitated workshops

**Differentiation:**
- **Continuous vs episodic:** Strategy development happens constantly, not just during planning cycles
- **Capture vs fill-in-blanks:** Accept input in any format vs structured forms
- **AI synthesis:** Automated dimensional analysis vs manual synthesis
- **Outside-in orientation:** Transforms company-centric thinking into customer-focused strategy

**Adjacent competitors:**
- **Strategic planning tools** (Cascade, Quantive): Focus on execution, not strategic thinking
- **Note-taking apps** (Notion, Roam): No strategic framework or synthesis
- **Facilitation consultancies**: High-touch, expensive, episodic

---

## 2. Technical Architecture

### Tech Stack Overview

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript | Modern, type-safe, excellent DX |
| **Styling** | Tailwind CSS, Shadcn UI components | Rapid iteration, consistent design |
| **Backend** | Next.js API routes (Edge runtime) | Serverless, zero DevOps overhead |
| **Database** | Vercel Postgres (Neon serverless) | Auto-scaling, no connection management |
| **ORM** | Prisma 5.22 | Type-safe queries, excellent migrations |
| **AI** | Claude API (Sonnet 4.5 via Anthropic SDK) | Best-in-class reasoning for strategic analysis |
| **Auth** | NextAuth.js with magic links | Secure, passwordless, minimal friction |
| **Experiments** | Statsig | A/B testing for product experimentation |
| **Email** | Resend | Transactional emails, confirmations |
| **Hosting** | Vercel | Git-based deployments, edge network |
| **Analytics** | Vercel Analytics, Statsig Session Replay | Performance monitoring, user behaviour |

### Database Schema

**Current schema:** V1 (production-ready, battle-tested through beta)

**Core entities:**

```
Project (boundary for strategic understanding)
├── Conversations (interactive questioning sessions)
│   └── Messages (chat history)
├── Fragments (extracted themes/insights)
│   └── FragmentDimensionTags (links to 11 dimensions)
├── DimensionalSyntheses (compressed understanding per dimension)
├── Documents (uploaded files)
├── DeepDives (focused research areas)
└── GeneratedOutputs (Decision Stack artifacts)
```

**Key design decisions:**
- **Flexible JSON schemas:** Avoid rigid tables that require migrations
- **Fragment-centric:** Fragments are the primary knowledge unit
- **Dimensional tagging:** Every fragment maps to 1+ strategic dimensions
- **Version chains:** Strategy outputs link to previous versions for incremental refresh
- **Experiment tracking:** Built-in support for A/B testing via `experimentVariant` field

**Schema stability:** Protected boundary with change policy. All modifications require:
1. Contract updates in `src/lib/contracts/`
2. Full verification suite (`npm run verify`)
3. Preview deployment testing
4. Documentation in CHANGELOG

### Data Flow: Conversation → Strategy

**1. Conversation Phase**
- User chats with Luna (AI strategy coach)
- Adaptive questioning based on experiment variant (E2 emergent vs E3 dimension-guided)
- Messages stored in real-time

**2. Extraction Phase**
- User clicks "End & Capture Insights"
- Claude API extracts 3-7 emergent themes from conversation
- Themes automatically tagged to strategic dimensions (inline during extraction)
- Creates Fragment records in database

**3. Synthesis Phase**
- Triggered asynchronously after extraction
- For each dimension: synthesise fragments into coherent understanding
- Stores summary, key themes, quotes, gaps, contradictions
- Incremental synthesis for performance (only new fragments)

**4. Generation Phase**
- User clicks "Generate Strategy"
- Claude API generates Vision/Strategy/Objectives from dimensional syntheses
- Creates GeneratedOutput record
- Links to ExtractionRun for experiment evaluation

**Key technical patterns:**
- **Streaming responses:** Claude API responses stream to client for better UX
- **Background processing:** Heavy synthesis work happens asynchronously
- **Optimistic UI:** Interface updates before API confirms (with rollback)
- **Data contracts:** Type-safe boundaries between pipeline stages

### Performance Characteristics

**Latency targets & actuals:**
- **Question generation:** <2s (actual: 1-2s)
- **Extraction:** <40s for 3-7 themes (actual: 15-30s depending on conversation length)
- **Synthesis:** <60s for 11 dimensions in parallel (actual: 30-50s)
- **Strategy generation:** <30s (actual: 20-25s)

**Token usage per user session:**
- Questioning: ~500-1000 tokens per question (3-10 questions typical)
- Extraction: ~2000-3000 tokens
- Synthesis: ~1000-2000 tokens per dimension (11 dimensions)
- Generation: ~2000-3000 tokens
- **Total:** ~20,000-30,000 tokens per complete flow

**Cost implications:**
- Claude Sonnet 4.5: $3.00/MTok input, $15.00/MTok output
- Typical session: ~$0.50-1.00 per user
- Database: Vercel Postgres scales automatically, minimal cost at current scale

**Scalability considerations:**
- **Current:** Serverless (Vercel Edge) handles 0-100k users without changes
- **Database:** Postgres connection pooling via Neon (no connection limit issues)
- **Claude API:** Rate limits not a concern at current scale (enterprise plan available)
- **Future:** Could add Redis for caching if needed (not required yet)

### Code Quality & Testing

**Testing strategy:**
- **Unit tests:** 55 tests covering core logic (fragments, synthesis, dimensional analysis)
- **Contract tests:** Validate data shapes at pipeline boundaries
- **Integration tests:** Full extraction → fragment → synthesis → generation flow
- **Smoke tests:** Critical path verification before deployment

**Verification commands:**
```bash
npm run verify       # Type-check + all tests + smoke tests (runs on pre-push hook)
npm run smoke        # Smoke tests only
npm run type-check   # TypeScript validation
```

**Code standards:**
- **TypeScript:** Strict mode enabled, no `any` types
- **Conventional commits:** Structured commit messages (`feat:`, `fix:`, `docs:`)
- **Pre-push hooks:** Automated verification prevents breaking changes
- **Contracts:** Data shape validation at extraction/persistence/generation boundaries

**Documentation:**
- **CHANGELOG.md:** Detailed version history (single source of truth)
- **ARCHITECTURE.md:** Technical architecture (this document's source)
- **CLAUDE.md:** Context for AI-assisted development
- **Experiment one-pagers:** Hypothesis, implementation, results for each A/B test
- **Inline code comments:** Rationale for non-obvious decisions

### Deployment & Infrastructure

**Git workflow:**
- `development` branch → Vercel preview deployments
- `main` branch → Production auto-deploy
- Direct commits to `development` (Jonny controls merges to `main`)

**Environments:**
- **Development:** Local (`npm run dev`)
- **Preview:** Vercel preview URLs (every push to `development`)
- **Production:** `app.lunastak.io` (auto-deploy from `main`)

**Database migrations:**
```bash
# Development
npx prisma migrate dev

# Production (via Vercel build)
npx prisma migrate deploy
```

**Environment variables:**
- `DATABASE_URL` – Postgres connection string (Neon serverless)
- `ANTHROPIC_API_KEY` – Claude API key
- `NEXTAUTH_SECRET` – Auth encryption key
- `STATSIG_SERVER_SECRET_KEY` – Experiment tracking
- `RESEND_API_KEY` – Email delivery

**Monitoring:**
- **Vercel Analytics:** Performance metrics, Core Web Vitals
- **Statsig:** A/B test results, session replay
- **Claude API logs:** Token usage, latency, errors

### Security & Privacy

**Authentication:**
- Magic link email (no passwords to leak)
- HTTP-only secure cookies
- NextAuth session management

**Data privacy:**
- User conversations are private (not shared between users)
- Guest users get isolated demo data
- No third-party analytics beyond Vercel/Statsig

**API security:**
- `ANTHROPIC_API_KEY` never exposed to client
- Server-side only API calls
- Input validation on all user-submitted content

**Future GDPR compliance:**
- Data export: Planned
- Right to deletion: Cascade delete on user removal
- Cookie consent: Only functional cookies (no tracking consent required)

---

## 3. Product Development & Experimentation

### Development Velocity

**Release history (since December 2025):**

| Version | Date | Key Features |
|---------|------|--------------|
| v1.0.0 | 13 Dec 2025 | Baseline (prescriptive extraction) |
| v1.1.0 | 17 Dec 2025 | E1a: Emergent extraction experiment |
| v1.2.0 | 22 Dec 2025 | Cold start entry points (document upload) |
| v1.3.0 | 3 Jan 2026 | E2: Dimensional coverage tracking |
| v1.4.0 | 4 Jan 2026 | Fragment extraction & synthesis implementation |
| v1.5.0 | 7 Jan 2026 | Project-centric navigation |
| v1.6.0 | 14 Jan 2026 | Deep Dives feature |
| v1.7.0 | 15 Jan 2026 | Beta launch (strategy refresh, guest flow) |

**Current velocity:** ~1 major release per week during intensive build phase

**Technical debt:** Minimal. "Okay for now" compromises documented in ARCHITECTURE.md with clear triggers for revisiting (e.g., "revisit when optimising for performance", "revisit if dimensions become dynamic").

### Experiment Framework

Lunastak uses **Statsig** for systematic A/B testing of extraction methodologies.

**Current experiment:** `questioning_approach`

**Variants:**
1. **baseline-v1** (E0): Prescriptive extraction (industry, target_market, unique_value)
2. **emergent-extraction-e1a** (E1a): Theme-based extraction, no prescribed fields
3. **dimension-guided-e3** (E3): Questions explicitly guided toward uncovered dimensions

**Measurement:**
- **Dimensional coverage:** % of 11 dimensions covered (target: >80%)
- **Quality rating:** Good/bad rating by researcher
- **Strategy generated:** Boolean completion metric

**Process:**
1. **Hypothesis:** Document in one-pager (`docs/experiments/one-pagers/`)
2. **Implementation:** Build variant, add experiment tracking
3. **Deployment:** Gradual rollout (0% → 10% → 25% → 50%)
4. **Analysis:** Statsig dashboard + manual trace review
5. **Decision:** Full rollout or iterate

**Recent learnings:**
- **E2 result:** Dimensional coverage is trackable and provides useful signal for gaps
- **E3 current:** Dimension-guided questioning shows promise but needs more data

### Future Technical Roadmap

**Near-term (next 3 months):**
- Upgrade Claude Sonnet 4.5 for better strategic reasoning (pending E3 completion)
- Document upload context prompts
- Date awareness fixes
- Metric polarity corrections
- "Devil's Advocate mode" feature

**Medium-term (3-6 months):**
- Team collaboration features (multi-user projects)
- Monthly business review automation
- Meeting transcript ingestion
- Mobile app (iOS/Android)

**Long-term (6-12 months):**
- Voice input integration
- Slack/Teams integrations
- Advanced strategy frameworks (Porter's 5 Forces, 7 Powers)
- Strategy simulation/scenario planning

---

## 4. Technical Risks & Mitigations

### Identified Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Claude API changes** | High | Medium | Wrapper abstraction (`createMessage`), version pinning |
| **Token cost spiral** | Medium | Low | Usage tracking, caching, prompt optimisation |
| **Schema migration complexity** | Medium | Low | Flexible JSON schemas, contract tests, preview testing |
| **Serverless cold starts** | Low | Medium | Neon serverless adapter, connection pooling |
| **Statsig dependency** | Low | Low | Feature flags, not core functionality. Can swap out. |

### Known Limitations

**Current constraints:**
- **Solo executive usage:** May be inherently episodic (risk: becomes "nice to have")
- **Blank page problem:** Users still need to initiate conversations (not fully solved)
- **Synthesis latency:** 30-50s synthesis time feels slow (acceptable for beta)

**Planned improvements:**
- **Team collaboration:** Drive habitual usage through team features
- **Proactive prompts:** Suggested questions based on dimensional gaps
- **Background processing:** Move synthesis to async queue for faster UX

---

## 5. Code Organisation & Maintainability

### Directory Structure

```
app.lunastak.io/
├── src/
│   ├── app/                    # Next.js pages & API routes
│   │   ├── api/               # Conversation, extract, generate endpoints
│   │   ├── project/           # Project dashboard pages
│   │   └── page.tsx           # Homepage
│   ├── components/            # React components
│   │   ├── ui/               # Shadcn UI primitives
│   │   └── *.tsx             # Feature components
│   ├── lib/                  # Core logic
│   │   ├── contracts/        # Data shape contracts
│   │   ├── synthesis/        # Synthesis algorithm
│   │   └── *.ts             # Services (fragments, claude, projects)
│   └── types/                # TypeScript type definitions
├── prisma/
│   └── schema.prisma         # Database schema
├── docs/                     # Documentation (gitignored, local only)
│   ├── plans/               # Implementation plans
│   └── experiments/         # Experiment documentation
├── scripts/                  # Utility scripts
│   ├── regenerate.ts        # Strategy regeneration
│   └── seed/                # Demo data seeding
└── .claude/                  # AI-assisted development context
```

**Key principles:**
- **Feature folders:** Group related components, no over-abstraction
- **Co-location:** Keep types, tests, and logic together
- **Flat structure:** Avoid deep nesting (max 2-3 levels)

### Developer Experience

**Setup time:** <5 minutes for new developers
```bash
git clone <repo>
npm install
cp .env.example .env.local  # Add keys
npm run dev                 # Running
```

**Key commands:**
```bash
npm run dev          # Start development server
npm run verify       # Full verification (type-check + tests + smoke)
npm run prisma:studio # Visual database browser
```

**AI-assisted development:**
- `.claude/` directory provides context for Claude Code
- `CLAUDE.md` has startup checklist and workflow guidance
- Architecture documentation co-evolves with code

---

## 6. Team & Development Practices

### Current Team

**Jonny (Founder/CTPO):**
- Full-stack development
- Product design
- Strategy consulting (Humble Ventures)

**Development approach:**
- Rapid iteration with comprehensive documentation
- AI-assisted development (Claude Code for velocity)
- Systematic experiment tracking
- Quality over speed (but both are high)

### Development Practices

**Git workflow:**
- Work on `development` branch
- Commit directly as work completes (no approval needed)
- Jonny controls merges to `main`
- Pre-push hook runs `npm run verify`

**Commit conventions:**
- `feat:` – New features
- `fix:` – Bug fixes
- `docs:` – Documentation
- `chore:` – Maintenance
- `refactor:` – Code restructure
- `test:` – Test additions

**Release process:**
1. Update `CHANGELOG.md` (move [Unreleased] to [X.Y.Z])
2. Update `package.json` version
3. Commit: `git commit -m "vX.Y.Z: Description"`
4. Push to development, create PR to main
5. Merge to main triggers production deploy

**Quality gates:**
- TypeScript strict mode (no `any` types)
- Pre-push verification (type-check + tests + smoke)
- Contract tests catch breaking changes
- Manual testing on preview deployments

---

## 7. Investor Questions & Answers

### Technical Scalability

**Q: Can this handle 10,000 concurrent users?**

A: Yes, without code changes. Current architecture:
- **Frontend:** Vercel edge network (global CDN)
- **Backend:** Serverless functions (auto-scale)
- **Database:** Neon serverless Postgres (connection pooling, auto-scale)
- **AI:** Claude API (enterprise plan available)

**Bottlenecks:** None identified at target scale. Could add Redis caching if needed.

### Cost Structure

**Q: What are the unit economics per user?**

A: Current estimates (will refine with real data):
- **Claude API:** ~$0.50-1.00 per session (20-30k tokens)
- **Database:** ~$0.01 per user per month (Vercel Postgres pricing)
- **Hosting:** Included in Vercel Pro plan ($20/month)

**Target:** LTV:CAC ratio of 3:1 (standard SaaS benchmark)

### IP & Defensibility

**Q: What's proprietary here?**

A: Three layers of defensibility:

1. **Methodology IP:** 11-dimension framework synthesises best practices (not novel individually, but combination is unique)
2. **Product design:** Continuous capture vs episodic planning (UX innovation)
3. **Data moat:** User conversations + fragment extraction = training data for improving methodology

**Not defensible:** Technology stack is standard (Next.js, Postgres, Claude API). Defensibility comes from product design and accumulated strategic data.

### AI Dependency

**Q: What if Claude API shuts down or pricing changes dramatically?**

A: Mitigation strategies:

1. **Abstraction layer:** All Claude calls go through `createMessage()` wrapper (easy to swap LLMs)
2. **Model-agnostic prompts:** XML-based prompts work across providers
3. **Alternative models tested:** OpenAI GPT-4, Anthropic Claude variants
4. **Pricing hedge:** Enterprise Claude agreement (volume discounts)

**Strategic insight:** LLM commoditisation is likely. Real value is methodology + product design + user data.

### Data Privacy

**Q: How do you handle sensitive business strategy data?**

A: Multiple safeguards:

1. **Encryption:** All data encrypted in transit (TLS) and at rest (Postgres)
2. **Isolation:** User conversations are private (no cross-user access)
3. **No training:** User data NOT used to train Claude models (Anthropic policy)
4. **GDPR ready:** Data export and deletion capabilities (planned)

### Technical Team Scaling

**Q: Can one technical founder execute on this roadmap?**

A: Current phase: Yes. Jonny has shipped 7 major releases in 6 weeks with high quality.

**Scaling plan:**
- **Months 1-6 (beta):** Solo founder sufficient (current state)
- **Months 6-12 (growth):** Hire senior full-stack engineer
- **Year 2+:** Small team (3-5 engineers)

**Rationale:** Modern stack enables high productivity. AI-assisted development (Claude Code) acts as force multiplier.

---

## 8. Conclusion

Lunastak is a technically sound, well-architected product built on modern best practices. The codebase is production-ready, with comprehensive testing, documentation, and systematic experimentation.

**Technical strengths:**
- **Modern stack:** Proven technologies (Next.js, Postgres, Claude API)
- **Quality:** 55 passing tests, contract validation, pre-push verification
- **Velocity:** 7 major releases in 6 weeks
- **Scalability:** Serverless architecture handles 0-100k users without changes
- **Maintainability:** Excellent documentation, clear code organisation

**Technical risks:** Low. Standard mitigations in place for identified risks (API changes, cost, schema migrations).

**Recommendation for investors:** The technology is not the risk. The product risk is solving the cold start problem effectively enough to drive habitual usage. Current beta is well-positioned to validate this with real users.

---

**Prepared by:** Jonny, Founder/CTPO  
**Contact:** jonny@humventures.com.au  
**Repository:** Private (access provided separately)  
**Live app:** https://app.lunastak.io

---

## Appendix: Key Files for Review

**Essential reading:**
- `CHANGELOG.md` – Version history and feature releases
- `ARCHITECTURE.md` – Technical architecture (source for this document)
- `prisma/schema.prisma` – Database schema
- `package.json` – Dependencies and scripts

**Product documentation:**
- `docs/experiments/one-pagers/` – Experiment documentation
- `.claude/README.md` – Development context
- `README.md` – Project overview

**Code entry points:**
- `src/app/api/conversation/continue/route.ts` – Conversation API
- `src/app/api/extract/route.ts` – Extraction API
- `src/app/api/generate/route.ts` – Strategy generation API
- `src/lib/synthesis/` – Synthesis algorithm
- `src/lib/fragments.ts` – Fragment management
