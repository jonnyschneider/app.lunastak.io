# Development Scripts

## regenerate.ts

Regenerate strategy from existing trace context without going through the full conversation flow.

### Use Cases

- **Testing prompt changes**: Modify generation prompts and quickly see results with existing context
- **Model comparison**: Test different models against the same context
- **Quick iteration**: Skip time-consuming Q&A and extractions during development
- **A/B testing**: Generate multiple variations from the same context

### Usage

```bash
# Using npm script (recommended)
npm run regen <traceId>

# Direct execution
npx tsx scripts/regenerate.ts <traceId>
```

### Example

```bash
npm run regen clxyz123abc456def789
```

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
