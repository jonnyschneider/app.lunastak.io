# Test Data Infrastructure Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish proper environment isolation and a fixture-based test data system for demos, development, and testing.

**Architecture:** Three separate Vercel Postgres databases (prod/preview/dev) with JSON fixture files that can be hydrated into accounts via CLI scripts. Fixtures validate against existing data contracts before writing.

**Tech Stack:** Vercel Postgres, Prisma, TypeScript (tsx scripts), existing data contracts

---

## 1. Environment Separation

### Three Vercel Postgres databases:

| Environment | Database | Purpose |
|-------------|----------|---------|
| Production | `lunastak-prod` | Real users, dogfood account |
| Preview | `lunastak-preview` | Vercel preview deployments, disposable |
| Development | `lunastak-dev` | Local development |

### How it works:

Vercel automatically injects `DATABASE_URL` based on environment:
- Production deployment → `lunastak-prod` connection string
- Preview deployments → `lunastak-preview` connection string
- Local `.env.local` → `lunastak-dev` connection string

### Preview database strategy:

All preview deployments share one database (not per-branch). This keeps costs down and is fine for beta - can reset anytime with hydration script.

### Migration approach:

1. Create 3 Vercel Postgres databases
2. Export dogfood conversation from current Prisma Postgres
3. Run `prisma db push` on each new database to create schema
4. Hydrate prod with dogfood data
5. Hydrate preview/dev with demo templates
6. Update environment variables in Vercel + local `.env`
7. Retire old Prisma Postgres instance

---

## 2. Fixture File Structure

### Directory layout:

```
scripts/
  seed/
    fixtures/
      baseline-conversation.json    # Raw conversation, no extraction
      demo-dogfood.json             # Complete dogfood data
      demo-fictitious.json          # Believable fake company
    hydrate.ts                      # Main hydration script
    export.ts                       # Export existing data to fixture
    validate.ts                     # Validate fixtures against contracts
```

### Fixture format:

```json
{
  "template": {
    "name": "demo-dogfood",
    "description": "Jonny's dogfood account with complete extraction"
  },
  "user": {
    "name": "Jonny Richardson",
    "email": "{{EMAIL}}"
  },
  "projects": [
    {
      "id": "{{PROJECT_ID}}",
      "name": "Humble Ventures Strategy",
      "knowledgeSummary": "Luna knows about...",
      "fragments": [...],
      "conversations": [
        {
          "title": "Initial strategy session",
          "status": "completed",
          "experimentVariant": "baseline-v1",
          "messages": [...],
          "traces": [...]
        }
      ],
      "deepDives": [...],
      "documents": [...]
    }
  ]
}
```

### Key design choices:

- **Placeholders** (`{{EMAIL}}`, `{{PROJECT_ID}}`) replaced at hydration time
- **Nested structure** mirrors data model - project contains conversations, fragments, etc.
- **Self-contained** - one fixture = one complete account
- **Variant support** - `experimentVariant` field on conversations, optional CLI override

---

## 3. Hydration Script

### Usage:

```bash
# Hydrate a new demo account
npm run seed:hydrate -- --fixture demo-dogfood --email demo1@example.com

# Hydrate with variant override
npm run seed:hydrate -- --fixture baseline-conversation --email test@example.com --variant baseline-v1

# Reset and rehydrate (wipes existing data for that email)
npm run seed:hydrate -- --fixture demo-dogfood --email demo1@example.com --reset

# Hydrate multiple accounts from same template
npm run seed:hydrate -- --fixture demo-fictitious --email investor1@demo.lunastak.io
npm run seed:hydrate -- --fixture demo-fictitious --email investor2@demo.lunastak.io
```

### Script flow:

1. Load fixture JSON
2. **Validate all entities against contracts**
3. Replace placeholders (`{{EMAIL}}` → provided email, generate fresh CUIDs)
4. Check if user exists (error unless `--reset` flag)
5. Create records in dependency order: User → Project → Fragments/Conversations → Messages → Traces → DeepDives → Documents
6. Report what was created

### Safety features:

- Refuses to run against production unless explicit `--production` flag
- `--reset` required to overwrite existing user
- Dry-run mode (`--dry-run`) to preview without writing
- Validates fixture structure before writing anything

---

## 4. Export Script

### Usage:

```bash
# Export a user's account to fixture file
npm run seed:export -- --email jonny@humbleventures.io --output demo-dogfood.json

# Export specific conversation only (for baseline seed)
npm run seed:export -- --conversation clxyz123 --output baseline-conversation.json
```

### Export flow:

1. Fetch user + all related data (projects, conversations, fragments, etc.)
2. Strip auto-generated fields (createdAt, updatedAt) or normalize them
3. Replace actual IDs with placeholders
4. Replace email with `{{EMAIL}}`
5. Validate output against contracts
6. Write to `scripts/seed/fixtures/`

---

## 5. Contract Validation

### Validation in hydration:

```typescript
import {
  validateFragment,
  validateDocument,
  validateEmergentExtraction,
  validatePrescriptiveExtraction
} from '@/lib/contracts';

// Before writing any fragment
for (const fragment of fixture.projects[0].fragments) {
  if (!validateFragment(fragment)) {
    throw new Error(`Invalid fragment in fixture`);
  }
}

// Before writing trace.extractedContext
if (trace.extractedContext) {
  const isValid = trace.experimentVariant?.includes('baseline')
    ? validatePrescriptiveExtraction(trace.extractedContext)
    : validateEmergentExtraction(trace.extractedContext);
  if (!isValid) {
    throw new Error(`Invalid extractedContext for variant`);
  }
}
```

### Standalone validation command:

```bash
# Validate all fixtures against current contracts (no DB write)
npm run seed:validate
```

Runs in CI to catch fixture drift when contracts evolve.

---

## 6. Fixture Maintenance Workflow

| Scenario | Action |
|----------|--------|
| Schema changes | Re-export affected fixtures, validate, commit |
| New demo scenario | Create account manually, run export, commit |
| Tweak existing demo | Edit JSON directly or re-export |
| Contract changes | Run `npm run seed:validate` to check all fixtures |

---

## Fixture Types

### 1. baseline-conversation.json
- Original conversation only (pre-extraction)
- Used to test extraction/generation pipeline
- Run regeneration scripts to populate derived tables

### 2. demo-dogfood.json
- Jonny's complete dogfood data
- All extractions, deep dives, documents
- For collaborator demos

### 3. demo-fictitious.json
- Believable fake company
- Similarly complete data
- For customer demos
