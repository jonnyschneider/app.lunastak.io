# Schema V1 Rollback Plan

**ONLY USE IF CRITICAL ISSUES FOUND**

## Rollback Steps

### 1. Revert application code
```bash
git revert [commit-hash-of-phase-5-changes]
```

### 2. Remove new models (DANGEROUS - LOSES DATA)
```bash
npx prisma db push --force-reset
```

Then manually remove from schema.prisma:
- Project model
- Fragment model
- FragmentDimensionTag model
- DimensionalSynthesis model
- GeneratedOutput model
- ExtractionRun model
- projectId from Conversation

### 3. Deploy reverted code

### 4. Verify old code works

## Partial Rollback (Keep Data)

If you want to keep new tables but revert app code:

```bash
git revert [commit-hash-of-phase-5-changes]
# Keep new tables, just don't use them
```

The app will continue to work with `projectId: null` for new conversations.

## Prevention

- Test thoroughly in staging first
- Run verification script before production deploy
- Monitor error rates after deploy

## Commit References

Schema V1 migration commits (development branch):
- `feat(schema): add Project, Fragment, DimensionalSynthesis, GeneratedOutput, ExtractionRun models`
- `migration: create default projects and initialize syntheses (Phase 2-4)`
- `feat(api): add project support to conversation creation`
- `test(migration): add data integrity verification script`
