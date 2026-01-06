# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


---
## [1.4.4] - 2026-01-06

### Added
- **Data Contracts** - TypeScript contracts for extraction/generation/persistence boundaries
  - `src/lib/contracts/` - Contract type definitions
  - Extraction contracts: EmergentExtractionContract, PrescriptiveExtractionContract
  - Persistence contracts: FragmentContract, FragmentDimensionTagContract
  - Generation contracts: GenerationInputContract, GenerationOutputContract
  - Validation functions for runtime checking

- **Contract Tests** - Integration tests verifying contracts at seams
  - `src/lib/__tests__/contracts/extraction-contracts.test.ts`
  - `src/lib/__tests__/contracts/generation-contracts.test.ts`
  - `src/lib/__tests__/contracts/persistence-contracts.test.ts`

- **Smoke Test** - End-to-end verification of critical path
  - `src/lib/__tests__/smoke.test.ts`
  - Tests extraction → fragment persistence → generation flow
  - Mocked AI responses for determinism

- **Verification Scripts**
  - `npm run smoke` - Run smoke tests only
  - `npm run verify` - Full verification (type-check + tests + smoke)

- **Pre-Push Hook** - Enforces verification before push
  - Runs `npm run verify` automatically
  - Blocks push on failure
  - Bypass with `--no-verify` when needed

### Documentation
- Added `src/lib/contracts/README.md` explaining contract usage
- Updated `.claude/architecture.md` with contracts documentation
- Added Schema Change Policy to protect Prisma schema

---
## [1.4.3] - 2026-01-06

### Changed
** Migrated to Sonnet 4.5 Model for Claude API, as Opus 3 has been retired. This should have been done a while ago!

### Added
** New API endpoint `/extraction` that displays synthesis, reflective summary, and fragment extraction for evals (not user facing)

## [1.4.2] - 2026-01-05

### Added - E3: Dimension-Guided Questioning + Auth Flow + Statsig Experiments

**E3 Experiment Implementation:**
- **Dimension-Guided Questioning** - Questions explicitly guided toward uncovered dimensions
  - New variant: `dimension-guided-e3` (running parallel with E2's emergent approach)
  - Updated `src/app/api/conversation/continue/route.ts` with variant-aware prompts
  - E3 prompt includes 11 Tier 1 strategic dimensions for Claude's awareness
  - E3 uses emergent theme extraction (same as E1a), not baseline prescriptive format
- **Experiment Documentation**
  - One-pager: `docs/experiments/one-pagers/E3-dimension-guided.md`
  - Statsig experiments guide: `docs/STATSIG_EXPERIMENTS.md`
  - Updated experiment register with E2/E3 parallel testing

**Statsig A/B Experiments:**
- **Proper Experiment Setup** - Migrated from feature gates to Statsig experiments
  - Experiment ID: `questioning_approach` with `variant` parameter
  - Valid variants: `baseline-v1`, `emergent-extraction-e1a`, `dimension-guided-e3`
  - Uses `VERCEL_ENV` for environment tier (production/preview/development)
- **Custom Event Logging** - Key metrics for experiment analysis
  - `dimensional_coverage` - Logged after extraction (0-100%)
  - `quality_rating` - Logged when user rates output (1=good, 0=bad)
  - `strategy_generated` - Logged after generation
  - Events flushed immediately in serverless environment
- **Helper Scripts**
  - `scripts/sync-ratings-to-statsig.ts` - Batch sync ratings from DB to Statsig
  - Manual override via `?variant=dimension-guided-e3` URL param

**Double Opt-In Auth Flow:**
- **Subscribe Endpoints** - Guest-to-auth conversion without upfront friction
  - `POST /api/subscribe` - Captures email, sends confirmation email
  - `GET /api/subscribe/confirm` - Confirms email, redirects to sign-in
  - Supports `conversationId` param for session transfer after auth
- **Global Session Transfer** - Reliable guest-to-auth data migration
  - `SessionTransferProvider` - Runs on any page, not just homepage
  - Triggers page reload after transfer to refresh UI state
  - Dispatches `strategySaved` event to update sidebar
- **Email Infrastructure**
  - `src/emails/` - Email components and templates (EmailLayout, SubscribeConfirmEmail)
  - `src/lib/resend.ts` - Shared Resend client with EMAIL_CONFIG
  - `src/lib/crypto.ts` - Token encryption for confirmation links
  - `src/lib/render-email.ts` - Email rendering utility
- **Note:** Duplicates infrastructure from marketing site (lunastak.io) for self-contained operation

**UI Refinements:**
- **Extraction Summary Redesign**
  - Main card: muted green background (`bg-primary/5`)
  - Theme cards: white background with shadow for visual pop
  - OR divider between "Generate" and "Continue" options
  - Quote-style follow-up question display in refine card
- **Intro Card Refresh**
  - Added Luna avatar (animated-logo-glitch.svg)
  - Playful copy: "I ask great questions, and I'm a really good listener"
  - Removed fast-track entry point, horizontal 3-column layout
- **Early Exit UX** - Improved flow when confidence is high
  - Green "Generate Strategy" button instead of "Type A or B"
  - OR divider with contextual follow-up question below
  - User can click button or reply to continue conversation
- **Sidebar Enhancements**
  - Version and variant indicator (only shown during active conversation)
  - Format: `v1.4.2 · dimension-guided-e3`
- **Statsig Client Integration**
  - Added `StatsigProvider.tsx` with session replay and web analytics autocapture
  - Client key configured via `NEXT_PUBLIC_STATSIG_CLIENT_KEY`

**Developer Tools:**
- **Stub Mode** for UI development
  - `GET /api/conversation/[id]/stub` - Loads real extraction data from DB
  - Use `?stub=conversationId` URL param to bypass API calls
  - Documentation in `.claude/README.md`
- **Trace API** - New endpoint for strategy page
  - `GET /api/trace/[traceId]` - Fetches trace data with ownership check

### Changed
- Removed `onFlagForLater` and `onDismiss` props from ExtractionConfirm (unused)
- RegistrationBanner now uses double opt-in flow instead of direct NextAuth

### Fixed
- E3 variant now uses emergent theme extraction (was incorrectly using baseline format)
- Subscribe confirm route uses `force-dynamic` for Next.js serverless
- Session transfer works regardless of which page magic link returns to

### Dependencies
- Added `@react-email/components` for email templating

### Environment Variables
- `RESEND_AUDIENCE_ID` - Resend audience ID for contact management
- `ENCRYPTION_KEY` - 32-byte hex key for token encryption (must match lunastak.io)
- `NEXT_PUBLIC_APP_URL` - App URL for confirmation links (must include https://)
- `NEXT_PUBLIC_STATSIG_CLIENT_KEY` - Statsig client SDK key
- `NEXTAUTH_URL` - Must be set to `https://app.lunastak.io` for production

---

## [1.4.1] - 2026-01-04

### Changed
- **Sidebar UX Improvements**
  - Added prominent "New Conversation" button in sidebar header with primary green styling
  - Increased sidebar width from 16rem to 21rem for better content display
  - Sidebar now closed by default
  - Added margin above "Starred" section for better visual spacing
  - Made logo clickable (navigates to home) and brand-colored (green)

- **Loading Indicator Refinements**
  - Simplified `ExtractionProgress.tsx`: removed animated dots and spinner, slowed pulse animation to 3s
  - Added consistent animated ellipsis loading indicator to `ChatInterface.tsx` and `IntroCard.tsx`
  - Unified loading state styling across all conversation components

---

## [1.4.0] - 2026-01-04

### Added - Fragment Extraction & Synthesis Implementation

**Overview:** Populates the new Schema V1 tables (Fragment, FragmentDimensionTag, DimensionalSynthesis, GeneratedOutput, ExtractionRun) by updating the extraction and generation flows.

**Core Features:**
- **Fragment Creation from Extraction** - Creates Fragment records from emergent themes during extraction
  - `src/lib/fragments.ts` - Fragment service with `createFragment`, `createFragmentsFromThemes`, `getActiveFragments`
  - `src/lib/dimensional-analysis.ts` - Added `convertCoverageToDimensionTags` function
  - Fragments tagged with Tier 1 dimensions via `FragmentDimensionTag` records
  - Extraction route (`/api/extract`) now creates fragments for project-linked conversations

- **Synthesis Algorithm** - Full and incremental synthesis for dimensional understanding
  - `src/lib/synthesis/types.ts` - `SynthesisResult`, `FragmentForSynthesis` types
  - `src/lib/synthesis/full-synthesis.ts` - Synthesizes all fragments into coherent understanding
  - `src/lib/synthesis/incremental-synthesis.ts` - Merges new fragments into existing synthesis
  - `src/lib/synthesis/update-synthesis.ts` - Orchestrates full vs incremental based on staleness, fragment count
  - Synthesis triggered asynchronously after fragment creation (doesn't block extraction response)

- **GeneratedOutput & ExtractionRun Tracking** - Evaluation infrastructure
  - `src/lib/extraction-runs.ts` - Creates ExtractionRun records with synthesis snapshots
  - Generation route (`/api/generate`) now creates GeneratedOutput and ExtractionRun records
  - Captures syntheses before/after for A/B evaluation

- **Guest User Isolation (HUM-49)** - Full data tracking for unauthenticated users
  - Guest sessions now create real User + Project records (`guest_<id>@guest.lunastak.io`)
  - Enables fragment tracking and ExtractionRun creation for all users
  - Session transfer moves all data (Projects, Conversations, Traces) when guest authenticates
  - `src/lib/projects.ts` - `createGuestUser`, `isGuestUser`, updated `getOrCreateDefaultProject`
  - `src/lib/transferSession.ts` - Now transfers Projects in addition to Conversations and Traces

- **Inline Dimension Tagging (HUM-47)** - More reliable dimension extraction
  - Dimensions tagged during theme extraction, not post-hoc matching
  - Extraction prompt includes dimension definitions for Claude
  - Eliminates fuzzy matching failures between theme names

- **Streaming Extraction Progress** - Better UX during long operations
  - `src/components/ExtractionProgress.tsx` - Step-by-step status display
  - Extract API streams JSON progress updates
  - Steps: extracting_themes → analyzing_dimensions → generating_summary → saving_insights

**Testing & Verification:**
- `scripts/test-fragment-flow.ts` - Integration test for fragment creation and synthesis
- Updated `scripts/migrations/verify-migration.ts` with checks 5-8 (fragments, syntheses, outputs, runs)
- `src/lib/__tests__/projects.test.ts` - 12 tests for guest user isolation
- `src/lib/__tests__/dimensional-analysis.test.ts` - 7 tests for inline dimension coverage
- All 55 tests pass, no TypeScript errors

**Documentation:**
- Updated `.claude/architecture.md` with Extraction → Fragment → Synthesis flow

### Changed
- **Documentation Consolidation** - Streamlined Linear integration documentation
  - Consolidated 5 separate Linear docs into `.claude/README.md` backlog management section
  - Migrated feature backlog to Linear issues (HUM-26 through HUM-31)
  - Keep only `linear-create-issue.ts` for ongoing use
- **Release Workflow Enhancement** - Added mandatory pre-release checklist to `CONTRIBUTING.md`
  - Ensures CHANGELOG.md, VERSION_MAPPING.md, and .claude/README.md are updated before release
  - 8-point checklist to prevent missing version documentation

### Removed
- **One-time Linear Scripts** - Removed setup and testing scripts after completion
  - Deleted `linear-setup.ts`, `linear-import-history.ts`, `linear-find-duplicates.ts`
  - Deleted `linear-check-team-repos.ts`, `test-linear-github.ts`
  - Removed corresponding npm scripts: `linear:setup`, `linear:import`, `linear:test`
- **Obsolete Test Folder** - Removed `/tests` directory
  - Contained only E1a manual test checklist (released in v1.1.0, Dec 2025)
  - UAT/testing now handled in implementation plans and PR descriptions
- **Redundant Claude API Call** - Removed `analyzeDimensionalCoverage` from extraction
  - Dimensional coverage now computed from inline dimensions (no separate Claude call)
  - Reduces extraction time by ~15-20 seconds

### Fixed
- **Extraction Timeout (HUM-48)** - Fixed 60s Vercel timeout during extraction
  - Increased `max_tokens` from 800 to 2000 for inline dimension prompt
  - Removed redundant dimensional analysis Claude call
  - Added EXTRACTION phase recovery handler in continue API
- **v1.3.0 Release Documentation** - Added missing release notes from 2026-01-03
  - Added v1.3.0 entry to CHANGELOG.md (E2 Dimensional Coverage Tracking)
  - Updated VERSION_MAPPING.md status: "Pending UAT" → "Production"
  - Updated .claude/README.md current version and date

---

## [1.3.0] - 2026-01-03

### Added - Experiment 2: Dimensional Coverage Tracking

**Overview:** Post-extraction dimensional analysis for emergent extraction (E1a), mapping emergent themes to 10 strategic dimensions for coverage validation and gap identification.

**Core Features:**
- **Dimensional Coverage Analysis** - Automated mapping of emergent themes to strategic dimensions
  - 10 Tier 1 strategic dimensions (Customer & Market, Strategic Intent, Differentiation & Advantage, etc.)
  - Claude API integration for theme-to-dimension mapping
  - Coverage percentage calculation (themes matched / total dimensions)
  - Dimension tags stored in database for querying and analysis
- **Backfill Script** - Apply dimensional coverage to existing traces
  - `scripts/backfill-dimensional-coverage.ts` - Processes historical data
  - Updates all emergent extraction traces with dimensional analysis
  - Batch processing with rate limiting
- **Analysis Tools** - Python functions and Jupyter notebooks
  - `scripts/dimensional_coverage_analysis.py` - Load and analyze coverage patterns
  - `notebooks/dimensional_coverage_analysis.ipynb` - Interactive exploration
  - Coverage distribution analysis, gap identification, theme mapping insights

**Technical Implementation:**
- New field: `Trace.dimensionalCoverage Json?` in Prisma schema
- `src/lib/dimensional-analysis.ts` - Core analysis logic
- API integration: extract → analyze dimensions → store → query
- TypeScript type definitions for dimensional coverage data
- Unit tests for dimension mapping logic

**Documentation:**
- Experiment one-pager: `docs/experiments/one-pagers/E2-dimensional-coverage.md`
- Implementation plan with UAT checklist
- Deployment strategy and rollback procedures

---

## [1.2.2] - 2025-12-30

### Fixed
- **React Hydration Error** - Fixed server/client mismatch in authentication state
  - Fetch session server-side in layout.tsx using `getServerSession()`
  - Pass session to SessionProvider to ensure consistent SSR/client rendering
  - Removed `suppressHydrationWarning` workaround
- **Foreign Key Constraint Error** - Fixed event logging timing issue
  - Event logging now waits for conversation creation before attempting to log
  - Prevents `'no-conversation-yet'` string from violating FK constraint
- **Conversation Not Loading** - Fixed missing flowStep state transition
  - Added `setFlowStep('chat')` when conversation starts
  - Chat interface now renders correctly after conversation creation
- **Defensive Error Handling** - Added validation for extractedContext structure
  - Type guard checks for prescriptive vs emergent extraction formats
  - User-friendly error message if invalid data structure received
  - Diagnostic logging for debugging extraction issues

### Technical
- Enhanced logging in extract API and frontend for debugging
- Improved type safety with runtime validation checks

---

## [1.2.0] - 2025-12-22

### Added - Cold Start Entry Points
- **Four Entry Point Options** - Multiple on-ramps to solve cold start problem
  - Guided Conversation (live) - Traditional Q&A flow
  - Upload Document (live) - Extract from PDFs, DOCX, TXT, MD files
  - Start from Canvas (fake door) - Visual strategy builder validation
  - Fast Track (fake door) - Quick multiple choice validation
- **Document Upload & Extraction** - unstructured.io integration
  - Drag-and-drop file upload with validation (10MB max)
  - AI-generated document summary before starting
  - Context-aware first question based on uploaded content
  - Document stored as system message for continuous reference
- **Redesigned Objective Cards** - Cleaner, more engaging SMART goals
  - Timeframe badge in top-left corner (3M/6M/9M/12M/18M)
  - Objective text decoupled from metrics and timeframes
  - Metric display: `↑ Market share | from 20% to 35%`
  - Intelligent parser extracts metrics from Claude-generated text
  - Supports flexible formats: percentages, currency, counts, qualitative
- **Info Dialog Component** - Separated educational content from fake doors
  - Bold text formatting support for markdown-style `**text**`
  - Real Google Decision Stack examples
  - No voting buttons (distinct from FakeDoorDialog)
- **Regeneration Tools** - Developer productivity for testing
  - Local script: `npm run regen <traceId>` for direct DB access
  - Remote API: `npm run regen:remote <traceId> [baseUrl]` for preview/prod
  - `/api/admin/regenerate` endpoint works on any deployment
  - Perfect for testing prompt changes without redoing Q&A

### Changed
- **Terminology Correction** - Renamed "Mission" to "Strategy" throughout
  - More accurate reflection of coherent choices concept
  - Updated types, UI labels, API prompts, XML tags
- **Enhanced Info Popovers** - Better examples and formatting
  - "Like this..." and "Not this..." headings (was "Good/Wooden")
  - Real-world Google examples for all Decision Stack elements

### Technical
- New dependencies: `unstructured-client`, `react-dropzone`, `tsx`
- New components: EntryPointSelector, DocumentUpload, DocumentSummary, FakeDoorDialog, InfoDialog
- New API routes: `/api/upload-document`, `/api/admin/regenerate`
- Event tracking: `entry_point_selected`, `document_uploaded`
- Environment: `UNSTRUCTURED_API_KEY` required for document upload
- Type updates: Added `direction`, `metricName`, `metricValue`, `timeframe` to ObjectiveMetric

---

## [1.1.0] - 2025-12-17

### Added - E1a: Emergent Extraction

**Experiment:** E1a (`emergent-extraction-e1a`)
**Hypothesis:** Completely freeform extraction (no prescribed fields) will produce less "wooden" outputs while maintaining dimensional coverage
**Status:** Implementation complete, ready for data collection

#### Features
- **Statsig SDK Integration** - Feature flag system for dynamic A/B testing
  - Server-side feature gates via `statsig-node`
  - Environment-based configuration
  - Graceful fallback to baseline when unavailable

- **Emergent Extraction Logic** - Extract 3-7 themes that emerge naturally from conversation
  - No prescribed fields (industry, target_market, unique_value)
  - Theme names generated by Claude based on actual conversation
  - Adaptive prompting based on variant

- **Dual Schema Support** - Type-safe handling of both extraction approaches
  - `EmergentExtractedContext` - Themes-based extraction
  - `PrescriptiveExtractedContext` - Field-based extraction (baseline)
  - Union types with type guards for safe discrimination

- **Adaptive Confidence Assessment** - Different evaluation criteria per variant
  - Emergent: "Do I understand this business strategically?"
  - Prescriptive: "Do I have enough for prescribed fields?"

- **Adaptive Generation** - Strategy generation uses appropriate context
  - Emergent: Generates from emergent themes
  - Prescriptive: Generates from core fields + enrichment

- **Dynamic UI** - ExtractionConfirm component adapts to schema
  - Emergent: Displays themes in card format
  - Prescriptive: Displays labeled fields
  - Shared reflective summary section

#### Testing & Analysis Tools
- **Variant Display** - Shows active variant in sidebar for easy verification
- **Variant Override** - URL parameter `?variant=X` for controlled testing
- **Dimensional Coverage Analyzer** (`scripts/dimensional_coverage.py`)
  - Retrospective analysis tool
  - Codes emergent themes to strategic dimensions
  - Validates E1a captures critical dimensions (>80% coverage target)
- **Test Plan** (`tests/e1a-test-plan.md`) - Complete manual testing checklist

#### Documentation
- **One-Pager** - `docs/experiments/one-pagers/E1a-emergent-extraction.md`
- **Deployment Guide** - `docs/deployment/E1A_DEPLOYMENT_GUIDE.md`
- **Updated Experiment Register** - Tracks E1a status and metrics
- **Implementation Plan** - Preserved in `docs/plans/`

#### Technical Details
- Feature flag: `emergent_extraction_e1a`
- Variant assignment: Dynamic via Statsig per user
- Database: `experimentVariant` field tracks variant per conversation
- Backwards compatible: Baseline-v1 unchanged, runs in parallel

### Changed
- `ExtractedContext` types now support variant discrimination
- API routes (`/api/extract`, `/api/generate`) handle both schemas
- Page state management updated for variant tracking

### Fixed
- Added debug logging for Statsig initialization and gate checks
- Environment variable validation for Statsig configuration

---

## [1.0.0] - 2025-12-13

### Added - E0: Baseline-v1

**Experiment:** E0 (`baseline-v1`)
**Purpose:** Establishes normalized control for all future experiments
**Status:** Complete and stable

#### Features
- **Adaptive Conversation Flow** - 3-10 questions based on confidence assessment
- **Prescriptive Extraction** - Structured extraction with core + enrichment fields
  - Core: industry, target_market, unique_value
  - Enrichment: competitive_context, customer_segments, operational_capabilities, technical_advantages
- **Reflective Summary** - Identifies strengths, emerging areas, and opportunities
- **Confidence-Gated Generation** - Only generates when confidence is HIGH/MEDIUM
- **Complete Strategy Output** - Vision, Mission, Objectives, Initiatives, Principles
- **Event Logging** - Comprehensive tracking for analysis
- **Quality Rating System** - Researcher can rate output quality (good/bad)
- **User Feedback** - Users can mark outputs as helpful/not_helpful

#### Infrastructure
- Next.js 14 app router
- Prisma ORM with PostgreSQL
- Claude API integration (Sonnet 3.5)
- TypeScript throughout
- Tailwind CSS + Catalyst UI

---

## Version-to-Experiment Mapping

| Version | Experiment | Variant ID | Description |
|---------|------------|------------|-------------|
| v1.0.0  | E0         | `baseline-v1` | Prescriptive extraction baseline |
| v1.1.0  | E1a        | `emergent-extraction-e1a` | Emergent theme extraction |

Future releases will increment according to semantic versioning:
- **Major (2.0.0):** Breaking changes, incompatible API changes
- **Minor (1.x.0):** New features, backward compatible
- **Patch (1.1.x):** Bug fixes, backward compatible

---

## Deployment Notes

### v1.1.0 Deployment

**Prerequisites:**
1. Statsig account with server secret key
2. Feature gate `emergent_extraction_e1a` created in Statsig dashboard
3. Environment variable `STATSIG_SERVER_SECRET_KEY` set in production

**Rollout Strategy:**
1. Deploy to production with gate at 0%
2. Enable for 2-3 test users via Statsig targeting
3. Gradual rollout: 10% → 25% → 50%
4. Target: 10-15 participants per variant
5. Analyze results before full rollout

**Rollback Plan:**
- Set Statsig gate to 0% (instant rollback, no code deployment needed)
- All users automatically revert to baseline-v1

See `docs/deployment/E1A_DEPLOYMENT_GUIDE.md` for full details.
