# Version to Experiment Mapping

This document maps release versions to experiment IDs for clarity.

## Active Versions

| Release Version | Experiment ID | Variant ID | Status | One-Pager |
|-----------------|---------------|------------|--------|-----------|
| **v1.1.0** | E1a | `emergent-extraction-e1a` | 🟡 Data Collection | [View](./docs/experiments/one-pagers/E1a-emergent-extraction.md) |
| **v1.0.0** | E0 | `baseline-v1` | 🟢 Complete (Baseline) | [View](./docs/experiments/one-pagers/E0-baseline-v1.md) |

## Version Scheme

We use **[Semantic Versioning](https://semver.org/)** for releases:

- **Major version (X.0.0):** Breaking changes, incompatible API changes
- **Minor version (1.X.0):** New features, experiments, backward compatible
- **Patch version (1.1.X):** Bug fixes, backward compatible

## Why Separate Version and Variant IDs?

**Release Versions** (`v1.1.0`):
- Follow semantic versioning standards
- Used for git tags, deployments, changelogs
- Increment predictably based on change type
- Easy to understand progression

**Variant IDs** (`emergent-extraction-e1a`):
- Stored in database for tracking
- Descriptive of experiment purpose
- Used in code for feature flagging
- Allows multiple variants per release

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

1. **Tag the release:** `git tag -a v1.1.0 -m "Release v1.1.0: E1a Emergent Extraction"`
2. **Update this file** with the new mapping
3. **Update CHANGELOG.md** with release notes
4. **Reference experiment docs** in deployment notes

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## Future Versions

Planned experiments will increment versions as follows:

- **v1.2.0** - E2: Energetic Prompts (planned)
- **v1.3.0** - E3: Lens Inference (planned)
- **v2.0.0** - Major architecture change (if needed)

## Notes

- Versions are **release-centric** (what we deploy)
- Variant IDs are **experiment-centric** (what we test)
- This separation keeps versioning clean while allowing descriptive experiment tracking
- The experiment register remains the source of truth for experiment details
