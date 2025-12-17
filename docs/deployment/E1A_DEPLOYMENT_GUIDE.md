# E1a Deployment Guide

**Release Version:** v1.1.0
**Experiment:** E1a (`emergent-extraction-e1a`)
**See:** [VERSION_MAPPING.md](../../VERSION_MAPPING.md) for version-to-experiment mapping

## Prerequisites

1. **Statsig Account Setup**
   - Create account at https://statsig.com
   - Create new project for Decision Stack
   - Get server secret key

2. **Feature Gate Configuration**
   - Create feature gate: `emergent_extraction_e1a`
   - Set initial rollout: 0%
   - Configure targeting rules (optional)

3. **Environment Variables**
   ```bash
   STATSIG_SERVER_SECRET_KEY=secret-xxxxxx
   ```

## Deployment Steps

### 1. Local Testing

```bash
# Install dependencies
npm install

# Set environment variables
echo "STATSIG_SERVER_SECRET_KEY=your-key" >> .env.local

# Type check
npm run type-check

# Build
npm run build

# Test locally
npm run dev
```

### 2. Manual Testing Verification

Follow checklist in `tests/e1a-test-plan.md`:
- [ ] Baseline-v1 flow works
- [ ] Emergent-e1a flow works (gate ON)
- [ ] Both schemas store correctly
- [ ] UI displays both variants correctly

### 3. Deploy to Vercel

```bash
# Add Statsig secret to Vercel
vercel env add STATSIG_SERVER_SECRET_KEY

# Deploy
git push origin development
# (Jonny merges to main when ready)
```

### 4. Feature Gate Rollout

**Initial rollout:** 0% - verify deployment works
**Test users:** Enable for specific user IDs
**Gradual rollout:** 10% → 25% → 50% until target sample size reached
**Full rollout:** Only if experiment passes

## Monitoring

### Check Variant Distribution

```sql
SELECT
  "experimentVariant",
  COUNT(*) as conversation_count
FROM "Conversation"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "experimentVariant";
```

### Check Quality Ratings

```sql
SELECT
  c."experimentVariant",
  t."qualityRating",
  COUNT(*) as count
FROM "Trace" t
JOIN "Conversation" c ON t."conversationId" = c.id
WHERE c."experimentVariant" IN ('baseline-v1', 'emergent-extraction-e1a')
  AND t."qualityRating" IS NOT NULL
GROUP BY c."experimentVariant", t."qualityRating"
ORDER BY c."experimentVariant", t."qualityRating";
```

### Statsig Dashboard

Monitor in Statsig:
- Feature gate exposure events
- User distribution
- Auto-captured events

## Rollback Plan

If issues discovered:

1. **Immediate:** Set feature gate to 0% in Statsig
2. **All users revert to baseline-v1**
3. **No code deployment needed**
4. **Investigate issues**
5. **Fix and redeploy if needed**

## Data Collection Timeline

- **Week 1:** Enable for 2-3 test users, verify everything works
- **Week 2-3:** Gradual rollout to reach 10-15 E1a participants
- **Week 4:** Analysis and decision (pass/fail/iterate)

## Success Metrics

Track weekly:
- Conversations completed (baseline vs E1a)
- Quality ratings collected
- User feedback collected
- Conversation completion rate

Target: 10-15 complete traces per variant before analysis
