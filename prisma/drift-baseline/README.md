# Schema drift baselines

Each `<env>.sql` file is the **approved** drift between `prisma/schema.prisma` and that environment's live database. It's the SQL that `prisma migrate diff` would emit to make the live DB match the schema.

`pre-push` runs `npm run db:check-drift`, which recomputes the diff against each env and compares to the baseline. If the actual drift differs from the baseline, the push is blocked — either because

- the schema has been changed in code without applying it to the env, or
- the env has been changed without updating `schema.prisma`, or
- some other unexpected drift has appeared.

## In sync = empty file

`preview.sql` is empty when preview matches the schema exactly. That's the goal state for every env.

## Why dev and prod have content right now

`dev.sql` and `prod.sql` currently encode the unfinished cleanup of `GeneratedOutput`, `StrategyVersion`, `UserContent` and `ExtractionRun.generatedOutputId`. The unified DecisionStack rollout dropped them in code and applied the drop to preview only — dev and prod still have the tables until a final cutover. The baseline files document that this is **known and accepted**, not silent drift.

After the legacy tables are dropped from dev and prod, run `npm run db:approve-drift` to recapture the (now empty) baselines and commit the change.

## Approving new drift

When you intentionally change the schema or directly modify a database, run:

```bash
npm run db:approve-drift
```

This rewrites every baseline file with the current actual diff. **Read the diff before committing.** If the new content surprises you, that's the drift check doing its job.

## Limitations

- `prisma migrate diff` connects to the URL in `DATABASE_URL_UNPOOLED` from each env file. If those files are missing on a developer's machine, the corresponding env is skipped (with a warning).
- The diff is normalised by trimming whitespace and stripping prisma's `-- This is an empty migration.` marker. Anything else is byte-compared.
