# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
