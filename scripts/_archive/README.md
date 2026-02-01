# Archived Scripts

Scripts preserved for reference but no longer actively used. Moved 2026-02-02.

## linear/

Linear API integration scripts. Moving to standalone skill for reuse across projects.

- `linear-comment.ts` - Add comments to issues
- `linear-create-issue.ts` - Create issues
- `linear-get-issues.ts` - Fetch issues
- `linear-list.ts` - List issues

## python-prototypes/

Early dimensional coverage analysis prototypes. Superseded by TypeScript implementations in `src/lib/dimensional-analysis.ts`.

**Note:** Uses outdated 7-dimension taxonomy (now 10 dimensions).

## migrations/

One-time backfill scripts that have already been executed:

- `backfill-conversation-titles.ts` - Added titles to existing conversations
- `backfill-dimensional-coverage.ts` - Computed coverage for existing extractions
- `sync-ratings-to-statsig.ts` - Synced historical ratings

## diagnostics/

Database diagnostic scripts. Useful for debugging but rarely needed:

- `check-dimensional-coverage.ts`
- `check-doc-fragments.ts`
- `check-docs.ts`
- `test-fragment-flow.ts`

## one-off-fixes/

Bug fix scripts for specific issues that have been resolved:

- `fix-stuck-doc.ts` - Fixed documents stuck in processing state
- `verify-adaptive-flow.ts` - Verified adaptive conversation flow
- `check-traces.ts/.js` - Database summary diagnostics
