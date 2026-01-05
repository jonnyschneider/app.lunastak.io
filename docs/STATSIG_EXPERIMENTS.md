# Statsig Experiments Guide

Quick reference for setting up A/B experiments.

## Custom Events (Logged from App)

| Event | Value | Triggered |
|-------|-------|-----------|
| `dimensional_coverage` | 0-100 (%) | After extraction |
| `quality_rating` | 1=good, 0=bad | When rated |
| `strategy_generated` | 1 | After generation |

## Creating Metrics

1. **Metrics** → **Metrics Catalog** → **Create**
2. For coverage/rating: Type = **Mean**, Event = `dimensional_coverage` or `quality_rating`
3. For completion: Type = **Event Count**, Event = `strategy_generated`
4. ID Type = **User ID**

## Creating Experiments

1. **Experiments** → **Create**
2. **ID must match code**: `questioning_approach` (or update `src/lib/statsig.ts`)
3. Add parameter: `variant` (string)
4. Configure groups with variant values (e.g., `emergent-extraction-e1a`, `dimension-guided-e3`)
5. Add metrics from catalog
6. **Click "Start"** - experiments don't run until started!

## Environment Tiers

App sends `VERCEL_ENV` as tier:
- `production` - main branch deployments
- `preview` - PR/branch deployments
- `development` - local dev

Target experiments to specific tiers in Statsig's environment settings.

## Troubleshooting

**Variant not applying:**
- Check logs for `[Statsig] Experiment lookup:`
- `experimentValue: {}` = experiment not found
- `ruleName: "Not started"` = click Start in Statsig
- `reason: "Unrecognized"` = redeploy to refresh SDK config

**Events not appearing:**
- Events batch and flush - check for `[Statsig] Events flushed` in logs
- New events take a few minutes to appear in Statsig

**Manual override for testing:**
```
?variant=dimension-guided-e3
```

## Helper Scripts

```bash
# Sync ratings from DB to Statsig
npx tsx scripts/sync-ratings-to-statsig.ts --dry-run
npx tsx scripts/sync-ratings-to-statsig.ts

# Regenerate strategy (also logs strategy_generated event)
curl -X POST https://your-url/api/admin/regenerate \
  -H "Content-Type: application/json" \
  -d '{"traceId": "xxx"}'
```

## Code Reference

- `src/lib/statsig.ts` - SDK init, experiment lookup, event logging
- Experiment name constant: `QUESTIONING_EXPERIMENT = 'questioning_approach'`
