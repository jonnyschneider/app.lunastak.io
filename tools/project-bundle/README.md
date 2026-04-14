# Project Bundle

The canonical egress/ingress format for Lunastak project data. **One boundary** —
all external tooling that produces or consumes project data must conform to this
schema.

## Files

| File | Purpose |
|------|---------|
| `schema.ts` | Zod schema. Source of truth for the bundle format. |
| `export.ts` | Read a project from a DB env, emit a validated bundle. |
| `restore.ts` | Read a bundle, validate, hydrate into a target DB env. |
| `validate.ts` | Validate bundle files against the schema (CI-friendly). |

## Commands

```bash
# Export a demo project from dev to JSON
npm run bundle:export -- --env dev --slug ferrari

# Restore (idempotent) into preview / prod
npm run bundle:restore -- --env preview --file src/data/demos/ferrari.json
npm run bundle:restore -- --env prod    --file src/data/demos/ferrari.json

# Dry-run a restore (parses + reports counts, no writes)
npm run bundle:restore -- --env preview --file src/data/demos/ferrari.json --dry

# Validate bundles (defaults to all of src/data/demos/*.json)
npm run bundle:validate
npm run bundle:validate -- path/to/some/bundle.json
```

## Bundle shape

See `schema.ts` for the authoritative definition. High-level:

```
{
  bundleVersion: 1,
  projectId, projectName, isDemo, demoSlug, description,
  exportedAt,
  knowledgeSummary, suggestedQuestions,
  decisionStack: { vision, visionElaboration, strategy, strategyElaboration,
                   objectives[], opportunities[], principles[] },
  fragments: [{ title, content, contentType, confidence, sourceType }],
  syntheses: [{ dimension, summary, keyThemes, keyQuotes, gaps,
                contradictions, subdimensions, confidence, fragmentCount,
                synthesisVersion }]
}
```

Component arrays (`objectives`, `opportunities`, `principles`) require an `id`
and pass through any other fields. The component shape can evolve without a
bundle-version bump as long as the `id` contract holds.

## Schema versioning — fail loud

`BUNDLE_VERSION` in `schema.ts` is checked against the file's `bundleVersion`
field on parse. The contract test at
`src/lib/__tests__/contracts/project-bundle-contracts.test.ts`:

1. Validates every `src/data/demos/*.json` against the schema. Drift between a
   committed bundle and the schema fails the test loudly.
2. Snapshots the JSON Schema generated from the Zod schema. Any structural
   change without an intentional snapshot update fails the test.

When you change the bundle shape:

1. Update `schema.ts`.
2. Bump `BUNDLE_VERSION`.
3. Re-export every demo (`npm run bundle:export -- --env dev --slug <slug>`).
4. Re-snapshot (`npm test -- -u project-bundle-contracts`).
5. Document the change in this README.

## Future work (not implemented)

Designed-for but deliberately deferred:

- **`--target-id` flag on restore** — hydrate a bundle into a project with a
  *different* ID than the one in the bundle. Enables the modify-and-reimport
  flow against an existing live project.
- **Versioned snapshot writes** — instead of overwriting live state, write to
  `DecisionStackSnapshot` so users can review a proposed change before promoting.
- **Component shape validation** — strict per-type schemas for objectives /
  opportunities / principles. Trade-off: tighter contract vs. friction on
  manual JSON edits.
