# Why `prod` has approved drift

Evidence table + Fragment.interpretationType/reviewedAt (SCHEMA_CHANGELOG 2026-09-04). Additive only. Applied to dev and preview; prod lands at deploy of feat/ground-truth-check-backend.

Approved 2026-09-08. Clears when the migration is applied to prod — re-run `npm run db:approve-drift -- --env prod --reason "in sync"` or, once every env is in sync, plain `npm run db:approve-drift`.
