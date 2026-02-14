# Dev Tools

## Pipeline Test UI (`/dev/pipeline-test`)

Testing interface for pipeline routes. Select a fixture, load a hydrated project, fire routes, capture and compare snapshots.

### Workflow

1. **Hydrate a fixture** to a dev project:
   ```bash
   npx tsx scripts/seed/hydrate.ts --fixture <name> --projectId <id> --reset
   ```

2. **Open** `http://localhost:3000/dev/pipeline-test`

3. **Select fixture** → paste project ID → click **Load** → select route → **Run**

4. **Save snapshots** from the UI (stored in localStorage)

### Injecting snapshots via curl

For background/async routes where the response isn't directly capturable (e.g. `/api/generate` returns `status: started` then runs in background), pull the result from DB and inject it:

```bash
# Pull generated output from DB
npx tsx -e "
const { prisma } = require('./src/lib/db');
(async () => {
  const output = await prisma.generatedOutput.findFirst({
    where: { projectId: '<PROJECT_ID>' },
    orderBy: { createdAt: 'desc' },
  });
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
})();
"

# Post as snapshot (picked up by UI on next page load)
curl -X POST http://localhost:3000/api/dev/snapshots \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "snap-<descriptive-name>",
    "fixture": "<fixture name>",
    "route": "<route label>",
    "payload": {},
    "response": <paste DB output here>,
    "timestamp": "<ISO timestamp>",
    "notes": "<what this snapshot represents>",
    "durationMs": 0
  }'
```

The UI checks `/api/dev/snapshots` on load and imports any pending snapshots into localStorage (one-time read, file is deleted after import).

### Fixture index

`scripts/seed/fixtures/index.json` — single source of truth for available fixtures. The UI reads this to populate the fixture selector.

### API routes

| Route | Purpose |
|-------|---------|
| `GET /api/dev/fixtures` | Serve fixture index |
| `GET /api/dev/fixtures/[file]` | Serve fixture JSON |
| `GET /api/dev/project-state?projectId=X` | Live DB state (conversations, fragments, traces) |
| `GET/POST /api/dev/snapshots` | Snapshot import/export bridge |

### Decision log

Pipeline changes are recorded in `docs/pipeline-decisions.md` with links to snapshot evidence.
