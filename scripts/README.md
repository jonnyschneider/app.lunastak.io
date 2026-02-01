# Development Scripts

## Seed Scripts

Hydrate test data into any account using fixtures. Useful for demos, testing, and development.

### Usage

```bash
# Basic usage
npm run seed:hydrate -- --fixture <name> --email <email>

# With reset (deletes existing user first)
npm run seed:hydrate -- --fixture complete-lunastak-2026-01-15 --email demo@example.com --reset

# Dry run (preview without changes)
npm run seed:hydrate -- --fixture complete-lunastak-2026-01-15 --email demo@example.com --dry-run

# Override experiment variant
npm run seed:hydrate -- --fixture complete-lunastak-2026-01-15 --email demo@example.com --variant baseline-v1
```

### Available Fixtures

**Naming convention:** `{stage}-{topic}-{date}.json`
- `conversation-*` = messages only (for testing extraction → generation)
- `extracted-*` = messages + fragments (extraction done, no generation)
- `complete-*` = full pipeline output (messages + fragments + traces)
- `context-*` = pre-built extraction context (for testing generation only)

| Fixture | Description |
|---------|-------------|
| `conversation-lunastak-2026-02-02` | Lunastak dogfooding - messages only, for full pipeline testing |
| `extracted-lunastak-2026-01-31` | Lunastak with extraction done, ready for generation |
| `extracted-4pl-logistics-2026-01-31` | 4PL logistics retention - extraction done |
| `complete-lunastak-2026-01-15` | Full Lunastak demo with fragments and traces |
| `complete-buildflow-2026-01-26` | BuildFlow demo with multiple conversations |
| `complete-simulated-saas-2026-01-15` | Simulated B2B SaaS journey |
| `context-4pl-2026-01-31` | Pre-built extracted context (for generation testing) |
| `empty-project` | Empty project for onboarding flows |
| `test-minimal` | Minimal fixture for unit tests |

### Options

| Flag | Description |
|------|-------------|
| `--fixture <name>` | Fixture name (required) |
| `--email <email>` | Email for new account |
| `--projectId <id>` | Hydrate into existing project (alternative to --email) |
| `--userId <id>` | Use existing user (optional with --projectId) |
| `--reset` | Delete existing user/project data first |
| `--dry-run` | Preview without writing to database |
| `--variant <variant>` | Override experiment variant on all conversations |
| `--production` | Allow running against production DB (use with caution) |

### Hydrating into Existing Projects

For UAT or testing with guest sessions, hydrate directly into an existing project:

```bash
# Get project ID from URL: http://localhost:3000/project/<projectId>
npx tsx scripts/seed/hydrate.ts --fixture extracted-4pl-logistics-2026-01-31 --projectId cml1o94x0004jcz9el2i8bdnz --reset
```

### Creating New Fixtures

1. Export from an existing account: `npm run seed:export -- --email user@example.com`
2. Or create manually in `scripts/seed/fixtures/<name>.json`
3. Validate with: `npm run seed:validate -- --fixture <name>`

---

## Regeneration Scripts

Two ways to regenerate strategies from existing traces:

### 1. regenerate.ts (Local Database)

Direct database access for local development.

### 2. regenerate-remote.ts (API Endpoint)

Works with any environment (local, preview, production) via HTTP API.

### Use Cases

- **Testing prompt changes**: Modify generation prompts and quickly see results with existing context
- **Model comparison**: Test different models against the same context
- **Quick iteration**: Skip time-consuming Q&A and extractions during development
- **A/B testing**: Generate multiple variations from the same context

---

## Local Regeneration (regenerate.ts)

**When to use:** Local development with direct database access

### Usage

```bash
# Using npm script (recommended)
npm run regen <traceId>

# Direct execution
npx tsx scripts/regenerate.ts <traceId>
```

### Example

```bash
npm run regen cm59hqx9z0001v8rnc2xjt9l4
```

---

## Remote Regeneration (regenerate-remote.ts)

**When to use:** Preview/production environments, or testing against deployed instances

### Usage

```bash
# Local (default)
npm run regen:remote <traceId>

# Preview/Production
npm run regen:remote <traceId> <baseUrl>
```

### Examples

```bash
# Local
npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4

# Preview deployment
npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4 https://dc-agent-v4-git-development-jonnyschneider.vercel.app

# Production
npm run regen:remote cm59hqx9z0001v8rnc2xjt9l4 https://dc-agent-v4.vercel.app
```

### API Endpoint

The remote script calls `POST /api/admin/regenerate`:

```bash
curl -X POST https://your-domain.com/api/admin/regenerate \
  -H "Content-Type: application/json" \
  -d '{"traceId": "cm59hqx9z0001v8rnc2xjt9l4"}'
```

---

### What it does

1. Loads the specified trace from the database
2. Extracts the `extractedContext` (core business context + enrichment)
3. Uses the same generation logic as the API route
4. Creates a **new** trace with regenerated strategy
5. Links it to the same conversation for comparison

### Output

```
🔄 Regenerating strategy from trace: clxyz123abc456def789

✓ Loaded original trace
  Conversation: clconversation123
  Model: claude-3-5-sonnet-20241022
  Created: 2025-12-22T10:30:00.000Z

🤖 Calling Claude API...
✓ Claude responded in 1234ms

✓ Saved new trace

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Results:

  Original trace: clxyz123abc456def789
  New trace:      clnew789def123abc456

  View at: http://localhost:3000/strategy/clnew789def123abc456

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Vision:
  [Generated vision statement]

🎯 Strategy:
  [Generated strategy statement]

📈 Objectives:
  1. [First objective]
  2. [Second objective]
  3. [Third objective]

✅ Regeneration complete
```

### Finding Trace IDs

**From the UI:**
- URL when viewing a strategy: `/strategy/<traceId>`

**From the database:**
```bash
npm run prisma:studio
```
Navigate to the `Trace` model and copy the `id` field.

**From terminal:**
```sql
-- Most recent traces
SELECT id, conversationId, createdAt FROM Trace ORDER BY createdAt DESC LIMIT 10;
```

### Notes

- Creates a **new trace** (doesn't overwrite original)
- Both traces link to the same conversation
- Useful for comparing different generations side-by-side
- Uses current `CLAUDE_MODEL` from environment
- Temperature fixed at 0.7 (same as production)

---

## Pre-Generate Testing (pre-generate.ts)

Test the generate API directly with pre-extracted context, bypassing the full extraction flow.

### Usage

```bash
# Run generation with pre-extracted 4PL context
npx tsx scripts/pre-generate.ts

# Preview payload without calling API
npx tsx scripts/pre-generate.ts --dry-run
```

### What it does

1. Loads pre-built `extractedContext` from `fixtures/context-4pl-2026-01-31.json`
2. POSTs to `/api/generate` with the themes and dimensional coverage
3. Streams the generation progress and outputs the strategy

### Use Cases

- Testing generation prompts without running full extraction
- Benchmarking generation performance
- Comparing strategy output quality across prompt versions

---

## Manual API Testing

Trigger extraction and generation from terminal or browser console.

### Extraction (curl)

```bash
# Trigger extraction for a conversation
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "<CONVERSATION_ID>"}'
```

### Generation (browser console)

After extraction completes, trigger generation from browser console:

```javascript
// Get conversationId from URL: /project/<projectId>/conversation/<conversationId>
const conversationId = '<CONVERSATION_ID>';

// Fetch extraction data first
const extractRes = await fetch('/api/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversationId })
});
const extractText = await extractRes.text();
const extractData = extractText.trim().split('\n')
  .map(line => { try { return JSON.parse(line); } catch { return null; } })
  .filter(Boolean)
  .find(d => d.step === 'complete')?.data;

// Trigger generation
const genRes = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId,
    extractedContext: extractData.extractedContext,
    dimensionalCoverage: extractData.dimensionalCoverage
  })
});
console.log(await genRes.text());
```

---

## API Flow Reference

Current extraction → generation pipeline (as of 2026-01-31):

### Extract Route (`/api/extract`)

1. **Extract themes** with inline dimension tags (1 Claude call)
2. **Compute dimensional coverage** from inline dimensions (no additional call)
3. **Create fragments** from themes in database
4. **Return immediately** with `extractedContext` (themes only)
5. **Background tasks** (via `waitUntil`):
   - `updateAllSyntheses` - Updates dimensional synthesis records
   - `generateKnowledgeSummary` - Updates project knowledge summary

### Generate Route (`/api/generate`)

1. **Receive** `extractedContext` (themes) + `dimensionalCoverage`
2. **Build prompt** from themes
3. **Generate strategy** (vision, strategy, objectives) via Claude
4. **Save** Trace, GeneratedOutput, ExtractionRun records
5. **Return** streaming progress with final statements

### Key Optimizations (commit 5b9707e)

- Reflective summary generation removed from critical path (~5-10s saved)
- Synthesis and knowledge summary updates deferred to background
- Result: ~30% faster extraction-to-strategy pipeline

---

## Archived Pipeline Runner (v1)

Run extraction → generation through archived v1 API implementation. Essential for backtesting against historical versions.

### Usage

```bash
# Run v1 against a fixture (hydrates temp conversation)
npm run pipeline -- --fixture conversation-lunastak-2026-02-02 --export

# Run v1 against existing conversation
npm run pipeline -- --conversationId <id> --export

# Keep temp data for inspection
npm run pipeline -- --fixture conversation-lunastak-2026-02-02 --keep
```

### Options

| Flag | Description |
|------|-------------|
| `--fixture <name>` | Hydrate temp conversation from fixture |
| `--conversationId <id>` | Use existing conversation |
| `--variant <variant>` | Override experiment variant |
| `--export` | Export trace to evals/traces/ |
| `--keep` | Keep temp data after fixture run |
| `--dry-run` | Preview without running |

### Backtesting Workflow

1. Run v1 against fixture: `npm run pipeline -- --fixture conversation-lunastak-2026-02-02 --export`
2. Run current via app, then export: `npx tsx scripts/export-trace.ts --traceId <id>`
3. Create eval: `npx tsx scripts/create-eval.ts --name "v1-vs-current" --traces <v1-trace>,<current-trace> --baseline <v1-trace>`
4. Compare at: `http://localhost:3000/admin/eval/<evalId>`

---

## Eval Infrastructure

Scripts for exporting traces and creating evaluation files. Used for comparing extraction/generation approaches.

### export-trace.ts

Export trace data from database to JSON for evaluation.

```bash
# Export specific trace
npx tsx scripts/export-trace.ts --traceId <id>

# Export all traces for a project
npx tsx scripts/export-trace.ts --projectId <id>

# Force overwrite existing exports
npx tsx scripts/export-trace.ts --traceId <id> --force
```

Outputs to `evals/traces/<traceId>.json`.

### create-eval.ts

Scaffold a new evaluation file referencing existing traces.

```bash
npx tsx scripts/create-eval.ts --name "comparison-name" --traces trace1,trace2 --baseline trace1
```

Creates `evals/<date>-<name>.eval.json` with empty evaluation structure.

### Eval Workflow

1. Export traces: `npx tsx scripts/export-trace.ts --traceId <id>`
2. Create eval: `npx tsx scripts/create-eval.ts --name "test" --traces id1,id2 --baseline id1`
3. View/edit at: `http://localhost:3000/admin/eval/<evalId>`

---

## Recovery Scripts

### backfill-extraction.ts

Re-run extraction on existing conversations to create/update fragments and synthesis.

```bash
npx tsx scripts/backfill-extraction.ts <conversationId>
```

**Use cases:**
- Conversations that failed extraction
- Recovery after schema changes
- Re-extracting with updated prompts

---

## Utility Scripts

### studio.sh

Quick launcher for Prisma Studio.

```bash
./scripts/studio.sh
```

---

## Archived Scripts

Scripts moved to `scripts/_archive/` - preserved for reference but no longer actively used.

| Archive | Contents | Reason |
|---------|----------|--------|
| `_archive/linear/` | Linear API integration scripts | Moving to standalone skill |
| `_archive/python-prototypes/` | Early dimensional coverage analysis | Superseded by TypeScript implementations |
| `_archive/migrations/` | One-time backfill scripts | Already executed |
| `_archive/diagnostics/` | Database diagnostic scripts | Rarely needed |
| `_archive/one-off-fixes/` | Bug fix scripts | Issues resolved |
