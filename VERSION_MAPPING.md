# Version to Experiment Mapping

This document maps release versions to experiment IDs for clarity.

## Active Versions

| Release Version | Experiment ID | Variant ID | Status | Notes |
|-----------------|---------------|------------|--------|-------|
| **v1.4.3** | E3 | `dimension-guided-e3` and `emergent-extraction` | 🟢 Production | Upgrade to Claude Sonnet 4.5 API [CHANGELOG](./CHANGELOG.md#143---2026-01-06) |
| **v1.4.2** | E3 | `dimension-guided-e3` and `emergent-extraction` | 🟢 Production | E3 dimension-guided questioning, double opt-in auth, UI refinements - [CHANGELOG](./CHANGELOG.md#142---2026-01-05) |
| **v1.4.1** | - | `emergent-extraction-e1a` | 🟢 Production | Sidebar UX & loading indicator refinements - [CHANGELOG](./CHANGELOG.md#141---2026-01-04) |
| **v1.4.0** | - | `emergent-extraction-e1a` | 🟢 Deployed | Fragment Extraction & Synthesis - [CHANGELOG](./CHANGELOG.md#140---2026-01-04) |
| **v1.3.0** | E2 | `emergent-extraction-e1a` | 🟢 Deployed | Dimensional Coverage Tracking - [One-Pager](./docs/experiments/one-pagers/E2-dimensional-coverage.md) - [CHANGELOG](./CHANGELOG.md#130---2026-01-03) |
| **v1.2.2** | - | `baseline-v1` or `emergent-extraction-e1a` | 🟢 **Production** | Bug fixes: hydration, conversation loading, event logging - [CHANGELOG](./CHANGELOG.md#122---2025-12-30) |
| **v1.2.1** | - | `baseline-v1` or `emergent-extraction-e1a` | 🟢 Deployed | Terminology: initiatives → opportunities - [CHANGELOG](./CHANGELOG.md#120---2025-12-22) |
| **v1.2.0** | - | `baseline-v1` or `emergent-extraction-e1a` | 🟢 Deployed | Cold Start Entry Points (document upload, fake doors) - [CHANGELOG](./CHANGELOG.md#120---2025-12-22) |
| **v1.1.0** | E1a | `emergent-extraction-e1a` | 🟡 Data Collection | Emergent Extraction - [One-Pager](./docs/experiments/one-pagers/E1a-emergent-extraction.md) |
| **v1.0.0** | E0 | `baseline-v1` | 🟢 Complete (Baseline) | Baseline - [One-Pager](./docs/experiments/one-pagers/E0-baseline-v1.md) |

## Version Scheme

We use **[Semantic Versioning](https://semver.org/)** for releases:

- **Major version (X.0.0):** Breaking changes, incompatible API changes
- **Minor version (1.X.0):** New features, experiments, backward compatible
- **Patch version (1.1.X):** Bug fixes, backward compatible

## Release Types

**Experiment Releases** (e.g., v1.1.0 E1a, v1.3.0 E2):
- Introduce new experiment variants
- Have dedicated one-pager documentation
- Change the experimentVariant field in database
- Require careful rollout and measurement

**Feature Releases** (e.g., v1.2.0):
- Add new features without changing experiment design
- Work across all existing variants
- Document in CHANGELOG only
- No experiment-specific tracking needed

**Patch Releases** (e.g., v1.2.2):
- Bug fixes and minor improvements
- No functional changes to experiments
- Document in CHANGELOG only

## Why Separate Version and Variant IDs?

**Release Versions** (`v1.2.2`):
- Follow semantic versioning standards
- Used for git tags, deployments, changelogs
- Increment predictably based on change type
- Easy to understand progression

**Variant IDs** (`emergent-extraction-e1a`):
- Stored in database for tracking
- Descriptive of experiment purpose
- Used in code for feature flagging
- Allows multiple variants per release (e.g., v1.2.x ran both baseline-v1 and emergent-extraction-e1a)

## Database Storage

The `experimentVariant` field in the database stores variant IDs, not version numbers:

```prisma
model Conversation {
  experimentVariant String @default("baseline-v1")
  // Possible values: "baseline-v1", "emergent-extraction-e1a", etc.
}
```

## Example Queries

### Find all conversations in v1.1.0 (E1a):
```sql
SELECT * FROM "Conversation"
WHERE "experimentVariant" = 'emergent-extraction-e1a';
```

### Compare baseline vs E1a:
```sql
SELECT
  "experimentVariant",
  COUNT(*) as count,
  AVG(CASE WHEN t."qualityRating" = 'good' THEN 1 ELSE 0 END) as pct_good
FROM "Conversation" c
JOIN "Trace" t ON c.id = t."conversationId"
WHERE "experimentVariant" IN ('baseline-v1', 'emergent-extraction-e1a')
GROUP BY "experimentVariant";
```

## Deployment Tracking

When deploying a new version:

1. **Tag the release:** `git tag -a v1.x.x -m "Release v1.x.x: Description"`
2. **Update package.json** version field
3. **Update CHANGELOG.md** with release notes
4. **Update this file** with the new mapping
5. **For experiments:** Reference experiment one-pager in this file
6. **Push tag:** `git push origin v1.x.x`

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

**Current Production Version:** v1.4.3

## Future Versions

Planned experiments will increment versions as follows:

- **v1.5.0** - E4: Real-Time Coverage Display (planned)
- **v1.6.0** - E5: Multi-Session Accumulation (planned)
- **v2.0.0** - Major architecture change (if needed)

## Notes

- Versions are **release-centric** (what we deploy)
- Variant IDs are **experiment-centric** (what we test)
- This separation keeps versioning clean while allowing descriptive experiment tracking
- The experiment register remains the source of truth for experiment details
