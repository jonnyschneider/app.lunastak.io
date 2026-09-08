# Schema drift baselines

Each `<env>.sql` file is the **approved** drift between `prisma/schema.prisma` and that environment's live database. It's the SQL that `prisma migrate diff` would emit to make the live DB match the schema.

`pre-push` runs `npm run db:check-drift`, which recomputes the diff against each env and compares to the baseline. If the actual drift differs from the baseline, the push is blocked — either because

- the schema has been changed in code without applying it to the env, or
- the env has been changed without updating `schema.prisma`, or
- some other unexpected drift has appeared.

## In sync = empty file

`preview.sql` is empty when preview matches the schema exactly. That's the goal state for every env.

## Why prod has content right now

`prod.sql` encodes the `Evidence` table and the two `Fragment` columns from SCHEMA_CHANGELOG's 2026-09-04 entry. Additive only; applied to dev and preview, and prod lands at deploy of `feat/ground-truth-check-backend`. The reason is recorded in `prod.why.md` and the drift check **prints it on every push**, so a pending migration nags rather than going quiet.

(The earlier `GeneratedOutput` / `StrategyVersion` / `UserContent` cleanup that used to live here has completed — those baselines are empty again.)

## Approving drift

**Pending a deploy — scope it and say why:**

```bash
npm run db:approve-drift -- --env prod --reason "why this is intentional and when it clears"
```

Writes only that env's baseline and records the reason in `<env>.why.md`. Every later run prints the reason beside the approved drift. `--reason` is required with `--env` — an unexplained baseline is how drift goes silent.

**Everything settled — recapture the lot:**

```bash
npm run db:approve-drift
```

Rewrites *every* baseline with the current actual diff. This is the blunt instrument: accidental drift on one env gets blessed alongside the change you meant, which is why SCHEMA_CHANGELOG entries used to have to say "must NOT be approved away". Use it only when every env is genuinely settled. **Read the diff before committing.** If the new content surprises you, that's the drift check doing its job.

## Limitations

- `prisma migrate diff` connects to the URL in `DATABASE_URL_UNPOOLED` from each env file. If those files are missing on a developer's machine, the corresponding env is skipped (with a warning).
- The diff is normalised by trimming whitespace and stripping prisma's `-- This is an empty migration.` marker. Anything else is byte-compared.
