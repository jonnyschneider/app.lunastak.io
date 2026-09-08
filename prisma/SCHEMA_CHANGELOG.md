# Prisma Schema Changelog

This file documents all schema changes for the Lunastak application.
Changes should be documented here before being pushed to ensure proper review.

---

## 2026-09-08 — `ExtractionRun` retired (drop DEFERRED to deploy)

**Destructive, deliberately not yet applied anywhere.** All code that read or wrote
`ExtractionRun` was deleted on `feat/ground-truth-check-backend`; the model stays in
`schema.prisma` marked `☠ DEAD` until that code has shipped. Code before destructive
migration — dropping the table while old code is deployed causes 500s on every generation.

**Why it went.** It was **write-only**. `createExtractionRun` ran on every generation
(`pipeline/generation.ts`), and the only readers were two viewer pages that were unlinked,
one middleware-shadowed and pinned to a single hardcoded conversation. No experiment or
evaluation tooling ever consumed it — `src/lib/experiment/`, `src/lib/evaluation/`, `scripts/`
and `tools/` contain no reference, and `scripts/one-offs/gate-fixture.ts:13` already classified
it as telemetry and excluded it from capture. Legacy evals infrastructure that was never wired
to anything.

**Not `Trace`.** `Trace` is live — read by `/api/trace/[traceId]`, `/api/quality-rating`,
`/api/strategies` and `/api/demo/strategy`. The deleted `/api/extraction/[id]` fell back to
`Trace.id`, which made the two look related. They are not.

**On deploy:** drop the `ExtractionRun` table, then
`npm run db:approve-drift -- --env <env> --reason "in sync"` per environment.

**Recovery:** tag `extraction-run-final` (`2812f38`) — `git checkout extraction-run-final -- <path>`.

---

## 2026-09-08 — `Fragment.contentType` gains `tension` (no migration)

**No schema change.** `contentType` is a free-form `String`, so a new domain value needs no
migration — which is exactly why this nearly went unrecorded. Logged here because the *domain*
changed even though the *column* did not.

- **`tension`** — written by the bundle-import transform (`src/lib/import/transforms/context-bundle.ts:74,195`,
  since `6a05fa8`) and read at `src/lib/ground-truth/derive.ts:137`, which keeps tensions out of
  the ground-truth review: a tension is the skill's reading across themes, not the user's own
  words, so it is not something to ask a user to verify.

**Values actually written today:** `theme`, `insight`, `tension`. Nothing writes `quote`,
`stat` or `principle`.

⚠ **Four declarations of this domain disagree** — `docs/architecture/intelligence-pipeline-v2.md`
§3 ERD, `src/lib/contracts/extraction.ts:38` (`theme|insight|tension`),
`src/lib/contracts/persistence.ts:71` (`'theme'` only, and `validateFragment` rejects the rest —
though it is never called), and `src/lib/fragments.ts:46`
(`theme|insight|quote|stat|principle`). Only `extraction.ts` matches reality. Not reconciled
here: narrowing `fragments.ts` is a code change with callers, not a doc fix.

---

## 2026-09-04 — `Evidence` table + two `Fragment` columns (ground truth check, slice 2)

**Additive only. Nothing dropped.** Applied to **dev and preview** (preview 2026-09-08); prod
deliberately not migrated yet and lands at deploy.

Prod's drift is recorded as a **scoped** approval — `prisma/drift-baseline/prod.sql` plus a
reason in `prod.why.md`, which `db:check-drift` prints on every push. That keeps the signal
loud instead of silencing it. Do **not** run blanket `npm run db:approve-drift` while this is
outstanding: it would rewrite every env's baseline and bless any accidental drift alongside
this one. Clear it after the prod migration with
`npm run db:approve-drift -- --env prod --reason "in sync"`.

- **`Evidence`** (new) — `fragmentId` FK (cascade), `text`, `sourceRole`, `verification`, `ordinal`.
  The verbatim span a fragment rests on. Source material is deliberately not persisted, so
  verification happens at ingest and only the result is stored.
  `verification` is three states, not a boolean: **`verified`** (matched the source),
  **`unverifiable`** (no source retained — every bundle import; never counts against a fragment,
  it is a property of the path), **`failed`** (source was there, span did not match).
- **`Fragment.interpretationType`** — `verbatim | interpretation`, self-reported by the extractor.
  Decides which question the ground truth check asks.
- **`Fragment.reviewedAt`** — distinguishes "active because reviewed and kept" from "active because
  never looked at". `status` alone cannot express it.

Phase 2 (synthesis gaps) adds a **second nullable FK** to `Evidence`, never a polymorphic
`subjectType`/`subjectId`.

Design: `docs/_plans/2026-08-27-ground-truth-preflight-design.md` §16.1.

## [Unreleased]

### 2026-07-05: Public Share Links (v2.5.1)

**Related Plan**: `docs/_plans/2026-07-05-public-share-links-design.md`

#### Project Model Additions
- `shareToken String? @unique` - 192-bit random base64url token; the unguessable URL is the security mechanism. Minted on first share-enable, persists across on/off toggles.
- `shareEnabled Boolean @default(false)` - "Anyone with the link can view" toggle
- `sharedAt DateTime?` - Last time sharing was turned on

**Migration risk**: Additive only (nullable + defaulted columns). Safe to apply before code deploy.

**API Changes**:
- New `/api/project/[id]/share` (GET/POST, strict owner-only, session auth only — no guest)
- New public page `/share/[token]` (server-rendered read-only Decision Stack)

---

### 2025-01-07: Conversation Title Field

**Purpose**: Better conversation identification in UI lists (sidebar, project page)

#### Conversation Model Addition
- `title String?` - Short descriptive title generated during extraction (e.g., "Market expansion strategy")

**Generation**: Title is generated by Claude during the extraction step and saved to the conversation. Existing conversations will show "Untitled conversation" until re-extracted.

**API Changes**:
- `/api/strategies` - Added `conversationTitle` field to response
- `/api/project/[id]` - Added `title` field to conversation summaries

---

### 2025-01-07: Projects, Documents & Multi-Session Design

**Related Plan**: `docs/plans/2026-01-07-projects-documents-design.md`

#### Project Model Additions
- `knowledgeSummary String? @db.Text` - AI-generated summary of project knowledge
- `knowledgeUpdatedAt DateTime?` - Timestamp of last knowledge summary update
- `suggestedQuestions String[] @default([])` - AI-suggested questions for strategy exploration
- `documents Document[]` - Relation to uploaded documents

#### New Model: Document
Tracks uploaded documents and their processing status.

```prisma
model Document {
  id            String    @id @default(cuid())
  projectId     String
  fileName      String
  fileType      String
  fileSizeBytes Int?
  uploadContext String?   @db.Text
  status        String    @default("pending") // pending | processing | complete | failed
  processedAt   DateTime?
  errorMessage  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fragments     Fragment[]

  @@index([projectId])
  @@index([status])
  @@index([createdAt])
}
```

#### Fragment Model Changes
- `documentId String?` - Optional reference to source document (for document-extracted fragments)
- `document Document?` - Relation to Document model

**Migration Notes**:
- All existing fragments have `documentId = null` (conversation-sourced)
- New fragments from document uploads will have `documentId` set, `conversationId` may be null

#### New Model: UserDismissal
Generic system for tracking user-dismissed items across the app.

```prisma
model UserDismissal {
  id        String   @id @default(cuid())
  userId    String
  itemType  String   // 'suggested_question' | 'focus_area' | 'tip' | etc.
  itemKey   String   // Content hash or identifier
  projectId String?  // Optional - scope to project
  createdAt DateTime @default(now())

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, itemType, itemKey, projectId])
  @@index([userId, itemType])
}
```

**Use Cases**:
- Dismissing suggested questions
- Dismissing areas of focus
- Future: onboarding tips, feature hints, notifications

---

## Contract Updates Required

When schema changes affect data contracts, update these files:

1. `src/lib/contracts/persistence.ts`
   - `FragmentContract.conversationId` now optional (can be null for document-sourced fragments)
   - Add `FragmentContract.documentId` as optional
   - Add `strategic_intent` to `VALID_DIMENSIONS`

2. `src/lib/contracts/extraction.ts` - No changes required

3. `src/lib/contracts/generation.ts` - No changes required

---

## Schema Version History

| Version | Date | Summary |
|---------|------|---------|
| 1.5.0 | 2025-01-07 | Projects, Documents, Multi-Session, UserDismissal |
| 1.4.x | Prior | Base schema with Conversation, Fragment, Trace, etc. |

## 2026-08-29 — Drop four unread `DimensionalSynthesis` columns

**Change:** `DimensionalSynthesis` loses `keyThemes`, `keyQuotes`, `contradictions`
and `subdimensions`.

```sql
ALTER TABLE "DimensionalSynthesis"
  DROP COLUMN "keyThemes", DROP COLUMN "keyQuotes",
  DROP COLUMN "contradictions", DROP COLUMN "subdimensions";
```

**Why:** all four were produced by every synthesis call and read by nothing.
`keyQuotes`, `contradictions` and `subdimensions` had no consumer at all.
`keyThemes` was read only by the incremental synthesis path — ~13% of synthesis
runs, while the field was produced on 100% of them — and a 10-dimension A/B on
real capture data measured continuity against the prior summary at 98% with it
and 98% without, with 10% fewer output tokens. `summary` carries the continuity.

Together the four were 37% of `full_synthesis` output, and that stage is ~61% of
workload cost.

**Ordering — this is a destructive migration.** The code that stopped reading and
writing these columns must be **deployed everywhere first**. Dropping them while
an older deployment is live would 500 on every synthesis read. Apply dev →
preview → prod only after the corresponding code is live in each.

**Recovery:** the data is not recoverable after the drop. It was never read by
any user-facing surface, so there is nothing to migrate or backfill.
