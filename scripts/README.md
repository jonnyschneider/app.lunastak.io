# Development Scripts

## Seed Scripts

Hydrate test data into any account using fixtures. Useful for demos, testing, and development.

### Usage

```bash
# Basic usage
npm run seed:hydrate -- --fixture <name> --email <email>

# With reset (deletes existing user first)
npm run seed:hydrate -- --fixture demo-dogfood --email demo@example.com --reset

# Dry run (preview without changes)
npm run seed:hydrate -- --fixture demo-dogfood --email demo@example.com --dry-run

# Override experiment variant
npm run seed:hydrate -- --fixture demo-dogfood --email demo@example.com --variant baseline-v1
```

### Available Fixtures

| Fixture | Description |
|---------|-------------|
| `demo-dogfood` | Full demo with conversations, fragments, and deep dives |
| `demo-simulated` | Simulated user journey data |
| `empty-project` | Empty project for testing onboarding flows |
| `test-minimal` | Minimal fixture for unit tests |

### Options

| Flag | Description |
|------|-------------|
| `--fixture <name>` | Fixture name (required) |
| `--email <email>` | Email for the account (required) |
| `--reset` | Delete existing user data first |
| `--dry-run` | Preview without writing to database |
| `--variant <variant>` | Override experiment variant on all conversations |
| `--production` | Allow running against production DB (use with caution) |

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
