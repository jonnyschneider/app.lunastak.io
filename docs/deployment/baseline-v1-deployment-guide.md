# Baseline-v1 Deployment Guide

**Version:** baseline-v1
**Date:** 2025-12-13
**Status:** Ready for Production

---

## Pre-Deployment Checklist

- [x] All changes committed to development branch
- [x] Development branch pushed to remote
- [x] Release notes written
- [x] PR description written
- [x] UAT testing completed
- [x] Session notes documented

---

## Deployment Commands

### Step 1: Create and Tag Baseline-v1 on Development

```bash
# Ensure you're on development branch
git checkout development

# Create baseline-v1 tag
git tag -a baseline-v1 -m "Release: Baseline-v1 - Experimentation Foundation

Establishes normalized control variant with:
- Simplified UX (removed lens selection, multi-line input, full-height chat)
- Comprehensive instrumentation (events, quality ratings, variant tracking)
- Analysis infrastructure (notebook updates, TraceAnalyzer enhancements)
- Honest empty states for initiatives and principles
- In-app education via info icons
- Fake door measurement for feature demand

This is the baseline against which all future experiments will be measured.

See RELEASE_NOTES.md and docs/session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md for details."

# Push tag to remote
git push origin baseline-v1
```

---

### Step 2: Create Main Branch (if it doesn't exist)

**Option A: Main branch doesn't exist yet**

```bash
# Create main branch from current development
git checkout -b main

# Push main to remote and set upstream
git push -u origin main
```

**Option B: Main branch already exists**

Skip to Step 3.

---

### Step 3: Merge Development to Main

```bash
# Checkout main branch
git checkout main

# Pull latest from remote (if main already existed)
git pull origin main

# Merge development into main
git merge development --no-ff -m "Release: Baseline-v1

Merge development branch containing baseline-v1 release.

This establishes the normalized control variant for experimentation with:
- Simplified UX and honest capability disclosure
- Comprehensive event tracking and quality assessment
- Analysis infrastructure for systematic improvement

All future experimental variants will be measured against this baseline.

See RELEASE_NOTES.md for full details."

# Push main to remote
git push origin main
```

---

### Step 4: Verify Tags and Branches

```bash
# List all tags
git tag -l

# Should show: baseline-v1

# List local branches
git branch

# Should show: development, main (with * on main)

# List remote branches
git branch -r

# Should show: origin/development, origin/main
```

---

### Step 5: Deploy to Production (Vercel)

**If using Vercel CLI:**

```bash
# Ensure you're on main branch
git checkout main

# Deploy to production
vercel --prod

# Or if you want to see deployment details first
vercel deploy --prod
```

**If using Vercel GitHub Integration:**

1. Verify main branch is pushed: `git push origin main`
2. Vercel will auto-deploy main branch to production
3. Check deployment status: `vercel ls` or visit Vercel dashboard

---

### Step 6: Post-Deployment Verification

**Database Migration:**

```bash
# SSH into production (if applicable) or run via Vercel CLI
npx prisma db push

# Verify Prisma client is regenerated
npx prisma generate
```

**Check Production:**

```bash
# Get production URL
vercel ls

# Or check Vercel dashboard for production URL
```

**Test in Production:**

1. Start a conversation
2. Verify multi-line input works
3. Verify full-height chat window
4. Complete conversation to extraction
5. Verify three-option UI (Continue/Flag/Dismiss)
6. Generate strategy
7. Check info icons work
8. Check edit buttons show "coming soon"
9. Check initiatives/principles show CTAs
10. Submit helpful/not helpful feedback

**Verify Database:**

```bash
# Check Event table exists
# Check Conversation.experimentVariant is set to 'baseline-v1'
# Check events are being logged

# Via Prisma Studio (if accessible)
npx prisma studio

# Or via database query tool
```

---

## Branching Strategy Going Forward

### Main Branch
- Production-ready code
- Only merge from development after UAT
- Protected branch (require PR reviews)

### Development Branch
- Integration branch for all work
- Feature branches merge here first
- UAT happens here before merging to main

### Experiment Branches
- Branch from development
- Format: `experiment/[experiment-name]`
- Examples:
  - `experiment/emergent-extraction`
  - `experiment/energetic-prompts`
  - `experiment/lens-inference`

### Workflow for Experiments

```bash
# Create experiment branch from development
git checkout development
git checkout -b experiment/emergent-extraction

# Make changes, commit
git add -A
git commit -m "feat: implement emergent theme extraction"

# Push experiment branch
git push -u origin experiment/emergent-extraction

# Run 10-15 test conversations in experiment branch
# Analyze results in notebook

# If experiment succeeds (better than baseline-v1):
# 1. Merge to development
git checkout development
git merge experiment/emergent-extraction

# 2. Run UAT on development
# 3. Merge development to main (becomes new baseline)
# 4. Tag new version

# If experiment fails:
# Keep experiment branch for reference, don't merge
# Document findings in docs/experiments/
```

---

## Rollback Plan

**If baseline-v1 has critical issues in production:**

```bash
# Option 1: Revert to previous commit on main
git checkout main
git log  # Find previous stable commit hash
git revert <commit-hash>
git push origin main

# Option 2: Cherry-pick fixes to main
git checkout main
git cherry-pick <fix-commit-hash>
git push origin main

# Option 3: Hotfix branch
git checkout -b hotfix/critical-issue main
# Make fixes
git commit -m "fix: critical issue"
git checkout main
git merge hotfix/critical-issue
git push origin main
```

**Database Rollback:**

If database migration causes issues:
1. Prisma migrations are additive (Event table, new fields)
2. Old code should still work (new fields are nullable)
3. If needed, manually remove new fields via SQL

---

## Monitoring Post-Deployment

### Check Event Logging

```python
# In Jupyter notebook
from scripts.trace_analysis import TraceAnalyzer
analyzer = TraceAnalyzer()

# Load recent events
events = analyzer.load_events(limit=100)
print(events['eventType'].value_counts())
```

### Check Quality Ratings

```python
# Check if reviewers are submitting quality ratings
traces = analyzer.load_traces(limit=50)
print(traces['qualityRating'].value_counts())
```

### Check Variant Distribution

```python
# Verify all conversations are tagged baseline-v1
traces = analyzer.load_traces(limit=100)
print(traces['experimentVariant'].value_counts())
```

---

## Communication

### Announce Deployment

**Internal Team:**
- Baseline-v1 is live in production
- All conversations now tagged with experiment variant
- Event logging is active
- Quality rating system ready for researchers

**Users (if applicable):**
- Improved conversation experience (multi-line input, full-height chat)
- Clearer options at extraction confirmation
- In-app learning via info icons
- Simplified feedback mechanism

---

## Next Steps After Deployment

1. **Monitor first 10 conversations**
   - Check event logging working
   - Verify no critical errors
   - Review user feedback

2. **Begin Priority 1 Experiment**
   - Create `experiment/emergent-extraction` branch
   - Implement emergent theme extraction
   - Run 10-15 test conversations
   - Compare quality ratings vs baseline-v1

3. **Document Findings**
   - Update experiment results in docs/experiments/
   - Share insights in team meeting
   - Plan next experiments based on learnings

---

## Troubleshooting

### Database Migration Fails

```bash
# Check current schema
npx prisma db pull

# Force push schema
npx prisma db push --force-reset  # CAUTION: Resets database

# Alternative: Manual SQL migration
# Connect to database and add fields manually
```

### Prisma Client Not Updated

```bash
# Regenerate client
npx prisma generate

# Clear Next.js cache
rm -rf .next

# Restart server
npm run dev
```

### Events Not Logging

- Check `/api/events` endpoint is deployed
- Verify database connection in production
- Check event logging code in components
- Review production logs for errors

---

## Reference Documents

- **Release Notes:** `RELEASE_NOTES.md`
- **PR Description:** `docs/pull-requests/baseline-v1-release.md`
- **Session Notes:** `docs/session-notes/2025-12-13_baseline-v1-normalization-and-instrumentation.md`
- **Testing Insights:** `docs/journal/2025-12-12-extraction-generation-learnings.md`

---

**Deployment Checklist Complete** ✅

Baseline-v1 is ready for production deployment and experimentation!
