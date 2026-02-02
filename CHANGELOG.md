# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---
## [1.7.7] - 2026-02-02

### Added

- **Eval UI Enhancements** - Richer trace comparison for backtesting
  - Pipeline metadata in trace headers (pipelineVersion, promptVersions, experimentVariant)
  - Full objective details: metrics, targets, timeframes, explanations, success criteria
  - Tag persistence and notes editing for evaluation workflow

- **Fixture Naming Convention** - Clearer fixture organization
  - `conversation-*` = messages only (for testing extraction → generation)
  - `extracted-*` = messages + fragments (extraction done, no generation)
  - `complete-*` = full pipeline output (messages + fragments + traces)
  - `context-*` = pre-built extraction context (for testing generation only)

- **Conversation-Only Fixture** - `conversation-lunastak-2026-02-02.json`
  - Messages-only fixture with `status: in_progress`
  - Enables full extract→generate flow testing via UI

### Changed

- **Pipeline Runner Simplified** - Removed `--version=current` support
  - V1 archived pipeline only (current API tested via app directly)
  - Cleaner backtesting workflow

### Fixed

- **Fixture Status for Testing** - Conversations hydrated with `in_progress` status
  - UI now shows "Create my strategy" button when expected
  - Enables full pipeline testing via browser

---
## [1.7.6] - 2026-02-01

### Added

- **Background Strategy Generation** - Fire-and-forget with polling
  - `/api/generate` returns immediately with `generationId`
  - Generation runs in background via Vercel `waitUntil()`
  - Client polls `/api/generation-status/[id]` every 2 seconds
  - Toast notification when strategy is ready with "View" action
  - User can navigate freely during generation (~15-30s wait eliminated)

- **Generation Status Indicators** - Visual feedback during processing
  - Sidebar shows Luna logomark + "generating..." during strategy generation
  - Knowledgebase status bar shows "adding knowledge and drafting strategy..."
  - Post-generation "updating..." state while knowledgebase syncs
  - Luna SVG replaces sparkles icons for brand consistency

- **Generation Status Context** - Centralized state management
  - `GenerationStatusProvider` tracks active generation across app
  - `useGenerationStatusContext` hook for components
  - `hasActiveGeneration()` for UI elements that should stay hidden until complete

### Fixed

- **Strategy Content Empty** - Increased `max_tokens` from 1000 to 4000
  - Claude response was being truncated mid-XML
  - `extractXML` returned empty strings for vision/strategy/objectives

- **Navigation After Generate** - Project page now listens for events
  - `strategySaved` event triggers data refetch
  - `generationComplete` event triggers delayed refetches (5s, 15s, 30s)
  - Ensures knowledgebase data catches up after strategy generation

- **Generate Button Timing** - Hidden during entire generation lifecycle
  - Button hidden while generating AND while knowledgebase syncs
  - 30-second grace period after generation for synthesis to complete

---
## [1.7.5] - 2026-01-31

### Changed

- **Skip Extraction Confirmation** - Go straight from extraction to generation
  - Removes interstitial "Here's what I understood" screen
  - Extraction completes → immediately triggers strategy generation
  - Reduces clicks but total wait time still needs background generation (see docs/in-progress)

### Fixed

- **Null Safety in ExtractionConfirm** - Handle missing reflective_summary
  - Emergent extraction no longer includes reflective_summary in response
  - Component now guards against undefined fields

### Added

- **New Seed Fixtures** - For UAT and testing
  - `demo-4pl.json` - 4PL logistics retention strategy conversation
  - `pre-generate-4pl.json` - Pre-extracted context for testing generate API
  - `pre-generate.ts` - Script to test generation with pre-extracted context

- **Updated Scripts Documentation** - Expanded scripts/README.md
  - Hydrating into existing projects (`--projectId`)
  - Pre-generate testing workflow
  - API flow reference section

---
## [1.7.4] - 2026-01-28

### Added

- **Strategy History Submenu** - Browse past strategies from sidebar collapsible menu

- **Deep Dive Topic Linking** - Conversations linked to topics
  - Chats started from deep dives auto-link to that topic
  - Topic chip in chat header shows current assignment
  - "Part of:" indicator in chat list with clickable chip

### Fixed

- **Guest Session Transfer** - Prevents duplicate projects on re-login
  - Empty guest projects deleted instead of transferred
  - Only projects with actual content merge into authenticated account
  - Root page defers project creation when guest cookie exists

- **Strategy Menu Stability** - Eliminates layout jank in sidebar
  - Consistent Collapsible structure with internal loading/empty states
  - Strategy labels now show date + time for uniqueness
  - Demo fixture traces offset by 1 hour for unique timestamps

- **GoToStrategyCard** - Simplified to static empty state ("More features shipping weekly")

### Improved

- **Opportunity Editor UX** - Better feedback and objective linking
  - Positive feedback when all coaching criteria pass
  - Inline contribution inputs below linked objectives
  - "Coaching" → "Suggested improvements"

- **Dashboard UX** - Simplified headers and clearer CTAs
  - Page heading simplified to "Your Thinking"
  - Orange "Generate new strategy" button with fragment count
  - Guest banner moved above tabs with orange CTA

- **Sidebar Navigation** - Cleaner icons and labels
  - "Current Strategy" → "Your Strategy" (Atom icon)
  - "Your Thinking" (Glasses icon) reordered above strategy

---
## [1.7.3] - 2026-01-24

### Fixed

- **Neon Database Cold Starts** - Serverless adapter for reliable connections
  - Added `@neondatabase/serverless` and `@prisma/adapter-neon` for HTTP-based queries
  - Eliminates `Error { kind: Closed, cause: None }` on cold starts

- **Demo Auto-Seeding Removed** - New users start with empty project
  - Removed demo seeding from NextAuth `createUser` event
  - Users now land in first-time experience, not demo project

- **Chat Counter After Strategy** - Correct "first strategy" banner logic
  - Added `hasStrategy` field to projects API response
  - Sidebar chat now correctly hides first-time banner after strategy generation

- **Sidebar Upload First-Time UX** - Launch chat after first document
  - When uploading first document via sidebar, inline chat auto-opens

### Changed

- **Beta Preview** - Sidebar label changed from "Early Access Preview" to "Beta Preview"

- **Timeouts & Reliability** - Prevent long hangs
  - Statsig initialization timeout reduced to 5 seconds
  - Claude API timeout reduced to 60 seconds (from 180s)

---
## [1.7.2] - 2026-01-24

### Added

- **Dashboard Progressive Disclosure** - Cleaner information architecture
  - **Luna's Memory Header** - Collapsed bar showing insights, chats, coverage stats
    - Expands to reveal full knowledge summary and 10 strategic dimensions
    - "X new to include" action opens synthesis dialog directly
  - **Layout Reorder** - Deep Dives moved up after action row (Docs/Chats/Strategies)
  - **Provocations Limit** - Shows 3 items with "Show X more" button (matches Gaps pattern)

- **Decision Stack Branding** - Strategy view visual refresh
  - Branded header with bottle green (#0A2933) background and logo
  - "Learn more about The Decision Stack" link to thedecisionstack.com
  - Strategy cards with white backgrounds, bottle green borders
  - Neon (#E0FF4F) timeframe badges and CTA buttons
  - Aubergine (#7F556D) metric text
  - Hint of teal (#EEF8FC) content area background

- **Streaming Generation Progress** - Consistent progress UI
  - `/api/generate` now streams progress updates (preparing → generating → saving → complete)
  - `ExtractionProgress` component supports both extraction and generation modes
  - `chat-sheet.tsx` and `InlineChat.tsx` consume streaming responses

- **Luna's Thinking Tab** - Redesigned insights display
  - Themes as full cards in 2-column grid (not hidden behind pills)
  - Reflection accordion with 3-card layout (Strengths, Emerging, Opportunities)
  - Reasoning accordion for Claude's strategic thinking
  - Monotone design matching app visual language

### Changed

- **Strategy Page Tabs** - Line-style tabs with centered layout
- **StrategyDisplay** - Removed internal max-width (parent container controls)

### Fixed

- **Synthesis Loop** - Fixed dialog re-triggering on complete
  - Removed automatic `onComplete` call during dialog open state
  - Data refresh now only happens when user clicks "Done"
  - Prevents component remount/re-trigger race condition

- **Unnecessary Synthesis Runs** - Skip dimensions with no new fragments
  - Added early exit when existing synthesis exists and no new data
  - Prevents redundant LLM calls during synthesis

---
## [1.7.1] - 2026-01-15

### Added
- **Refresh Strategy Feature** - Regenerate strategy with new knowledge
  - Compare existing vs new fragments using `knowledgeUpdatedAt` timestamp
  - Generate change summary highlighting what's new
  - Version chain via `GeneratedOutput.previousOutputId`

- **Deep Dive Document Linking** - Documents uploaded from deep dive sheet are linked
  - `deepDiveId` passed through upload flow
  - Documents show in deep dive sheet's "Docs & Memos" tab

- **View-Only Initial Conversations** - Original strategy conversation is read-only
  - Prevents overwriting decision stack by continuing initial conversation
  - Identified by: no deepDiveId, extracted status, oldest createdAt

- **Early Access Preview Label** - Version badge in sidebar footer
  - Shows "Early Access Preview v1.7.x" for all users
  - Replaced demo mode badge

### Changed
- **Deep Dive Sheet Refactor** - Tabbed layout with Chats and Docs tabs
  - Removed resolve/dismiss buttons (redundant stubs)
  - ItemGroup pattern with "show more" for long lists
  - Consistent styling with Chats module tabs

- **Chat Scroll Anchoring** - Messages container auto-scrolls to latest

### Fixed
- **Guest User API Routes** - All deep dive and strategy routes now support guest cookies
- **Demo Seeding in Vercel** - Fixture files bundled via `outputFileTracingIncludes`
- **Insights Counter** - Fixed "all fragments new" by setting `knowledgeUpdatedAt` after fragment creation
- **Schema Sync** - `previousOutputId` column added to production database

---
## [1.7.0] - 2026-01-14

### Added
- **Structured Provocations** - Suggested questions and strategic gaps now have title + description
  - Schema: `suggestedQuestions` and `gaps` changed from `String[]` to `Json` (structured objects)
  - Generation prompts updated to output `{title, description}` format
  - UI displays title prominently with description below
  - Removes `parseProvocation()` hack that split strings on delimiters

- **Slack Signup Notifications** - Get notified when new users create accounts
  - Set `SLACK_WEBHOOK_URL` environment variable to enable
  - Fires on NextAuth `createUser` event

- **Project Page UI Polish**
  - "Unfinished" badge now navigates to Chats with "In Progress" tab open
  - "New to include" badge always visible (gray when 0, green when >0)
  - Chats module uses controlled tabs for programmatic navigation

### Changed
- **Seed Fixtures** - All demo fixtures updated with structured provocation format
  - `demo-extended.json`, `demo-dogfood.json`, `demo-simulated.json`, `test-minimal.json`

### Fixed
- **Prisma JSON Serialization** - Workaround for Prisma treating parsed JSON as text[]
  - JSON round-trip (`JSON.parse(JSON.stringify())`) in seed scripts

---
## [1.6.1] - 2026-01-14

### Added
- **useProjectActions Hook** - Consolidated project action logic into reusable hook
  - `createProject()`, `restoreDemo()`, `deleteProject()` with loading states
  - Optional paywall integration for create action
  - Used by HomePage, AppSidebar, and EmptyProjectState

- **Syntheses Support in Fixtures** - Fixture hydration now creates DimensionalSynthesis records
  - `FixtureSynthesis` type added to fixture schema
  - Demo fixtures can specify coverage levels and gaps per dimension
  - Enables "Close Gaps" section to work with demo data

### Changed
- **Project Combobox Reorganized** - All project actions now in one place
  - Add Project, Restore Demo, Delete Current Project moved from Settings menu
  - Cleaner separation: projects list above, actions below

- **Page Headings Updated**
  - Strategy page: "Current Strategy: Decision Stack"
  - Historical strategy view: "Decision Stack" with generated date
  - Thinking page: "Refine Your Strategic Direction" (unchanged)

- **New User Demo Fixture** - Switched from `demo-simulated` to `demo-extended`
  - BuildFlow construction project management scenario
  - Richer content: 2 conversations, 3 documents, 2 deep dives, 12 fragments
  - Includes dimensional syntheses with intentional gaps (GO_TO_MARKET, RISKS_CONSTRAINTS)

---
## [1.6.0] - 2026-01-14

### Added - Project Navigation Restructure

**Sidebar Improvements:**
- **Project Switcher Combobox** - Searchable dropdown replaces logo in sidebar header
  - Quick project switching without navigating away
  - Search filter for users with many projects
- **Fixed Action Buttons** - "New Chat" and "Upload Document" always visible in sidebar
  - Context-aware: actions apply to currently selected project
- **Cleaner Menu Design** - Removed chevrons from all collapsible sections
  - Reduces visual clutter, avoids clash with context menus

**Thinking Page Enhancements:**
- **Section Reordering** - Documents/Chats/Generated Strategies now above "What Luna Knows"
  - Prioritizes user content over system analysis
- **Gap Summaries** - "Close Gaps" section now displays dimension summaries and up to 3 specific gaps
- **Updated Heading** - Page heading changed to "Refine Your Strategic Direction"

**Strategy View Improvements:**
- **Project Context Header** - Strategy view now shows project name and description
- **Trace API Enhancement** - Returns `projectId` and `projectName` for better context

### Changed
- **Sidebar Labels** - "Strategy" → "Current Strategy" for clarity
- **Module Labels** - "Generated Strategy" → "Generated Strategies"
- **Simplified Strategy Route** - `/project/[id]/strategy` now redirects to latest trace

### Dependencies
- Added `@radix-ui/react-popover` for popover component
- Added `cmdk` for command palette component

---
## [1.5.2] - 2026-01-07

### Added
- **Project Empty State** - Focused "Get Started" view for empty projects
  - Two CTAs: "Start a Conversation" and "Upload a Document"
  - Shown when project has no fragments AND no conversations
  - CTA also added to empty "What Luna Knows" section

### Changed
- **Homepage Cleanup** - Simplified for guest-only flow
  - Removed `isAuthenticated` prop from `EntryPointSelector` and `IntroCard`
  - Gated features now always show lock icon (guests see sign-in gate)
  - Authenticated users auto-redirected to Project view

### Fixed
- **New Chat Navigation** - Authed users now go straight to conversation
  - Previously showed IntroCard entry point selector
  - Now auto-starts conversation when clicking "New Chat" from project
- **Long Filename Overflow** - Fixed document upload dialog overflow
  - Added proper overflow handling to truncate long filenames

---
## [1.5.1] - 2026-01-07

### Added
- **Universal Claude Truncation Detection** - All Claude API calls now use `createMessage()` wrapper
  - Automatic warning logs when responses hit `max_tokens` limit
  - Enforcement test prevents bypassing wrapper (`claude-wrapper.test.ts`)
  - Documented in `docs/ARCHITECTURE.md`

- **Contextual Gap Questions** - "Worth Exploring" items now show meaningful questions
  - Questions reference what Luna already knows about the business
  - Generated during `generateKnowledgeSummary` from full project context
  - Stored in `DimensionalSynthesis.gaps` for dimensions without fragments

- **Sign-In Gate for Premium Features** - Document upload and canvas gated behind auth
  - `SignInGateDialog` component prompts sign-in for gated features
  - Lock icon indicator on gated entry point cards
  - Guided Conversation remains available for guests

### Fixed
- **Guest-to-Auth Project Merge** - Fixed duplicate project issue during authentication
  - Previously: guest + existing user projects both transferred → 2 projects
  - Now: guest project data merged into existing project, "Guest Strategy" deleted
  - Prevents confusing "Guest Strategy" + "My Strategy" scenario

- **Knowledge Summary Race Condition** - Fixed missing gaps and "What Luna knows" summary
  - Both synthesis and knowledge summary were triggered in parallel after extraction
  - Knowledge summary now runs AFTER synthesis completes (sequential, not parallel)
  - Ensures `fragmentCount` is accurate when generating dimension-specific gap questions

- **Fire-and-Forget Serverless Issue** - Fixed background tasks not completing on Vercel
  - Document uploads stuck in "processing" - now awaits `processDocument()`
  - Extraction synthesis not completing - now awaits `updateAllSyntheses()`
  - All async operations properly awaited before response completes

- **Slow Extraction Performance** - Parallelized dimension syntheses
  - Dimension syntheses now run in parallel (was sequential)
  - Knowledge summary still runs after all syntheses complete

- **Jarring Page Reloads** - Smoother UX after authentication
  - Disabled NextAuth `refetchOnWindowFocus` to prevent reload on tab switch
  - Session transfer uses `router.refresh()` instead of `window.location.reload()`

### Removed
- **Deprecated Document Upload Flow** - Removed old home page document upload
  - Deleted `/api/upload-document` route (used wrong pipeline)
  - Deleted `DocumentUpload.tsx` and `DocumentSummary.tsx` components
  - Authenticated users should use project dashboard for document upload

---
## [1.5.0] - 2026-01-07

### Added - Project-Centric Navigation & Multi-Session Polish

**Project-First Navigation:**
- **Homepage Redirect** - Authenticated users now redirected to project dashboard
  - Redirect skipped if URL has `question`, `deepDiveId`, or `projectId` params
  - Unauthenticated users see intro flow as before
- **Sidebar Restructure** - Removed conversations section, added quick actions
  - New Chat and Upload buttons in sidebar body
  - Lunastak logo in sidebar header
  - Projects and Your Lunastak sections remain

**Project View Enhancements:**
- **Conversation Starring** - Star conversations directly from project view
  - Starred (3) and Recent (3) sections with expand/collapse
  - Star persists via Trace model (leverages existing infrastructure)
  - New API: `POST /api/conversation/[id]/star`
- **Conversation Titles** - Generated during extraction, shown in lists
  - Titles like "Market expansion strategy", "B2B pricing model"
  - Backfill script for existing conversations
  - Date format: "13 Jan '26"
- **Deep Dives Polish** - Consistent dismissal UX
  - Whole item clickable to open sheet
  - X button and dropdown dismiss option
  - Dismiss button in sheet alongside Resolve
  - Status badges: "In progress", "Ready to explore", "Resolved"

**UI Polish:**
- **Layout** - Knowledge Base card combines stats + dimensional coverage
- **Luna Wonders** - Renamed from "Opportunities to Enrich"
- **Worth Exploring** - Renamed from "Areas of Focus" with better positioning
- **Deep Dives** - Renamed to "Your Deep Dives" for personalization

### Changed
- Sidebar truncation: Recent conversations limited to 5 with "See more"
- Project view conversations limited to 3+3 (starred + recent)

### Fixed
- Deep dive dismissal wired to UserDismissal API
- Conversation-level deferral controls visibility

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
