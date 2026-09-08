# Why `prod` has approved drift

Evidence table + Fragment.interpretationType/reviewedAt (SCHEMA_CHANGELOG 2026-09-04), plus DecisionStackSnapshot.fragmentIds (2026-09-08). All additive. Applied to dev and preview; prod lands together at deploy of the ground-truth review.

Approved 2026-09-08. Clears when the migration is applied to prod — re-run `npm run db:approve-drift -- --env prod --reason "in sync"` or, once every env is in sync, plain `npm run db:approve-drift`.
