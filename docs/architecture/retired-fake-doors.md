# Retired: every fake door

**Retired:** 2026-09-08 (`f307dab`) · **Recovery tag:** `fake-doors-final` (`6b988a7`)

```bash
git checkout fake-doors-final -- src/app/project/\[id\]/outcomes/page.tsx   # or any path below
```

## What it was

Nine Pro-feature fake doors: a surface that looked like a feature, and on click showed a
coming-soon interstitial with an Upgrade button. Instrumented with `fake_door_view` (the door was
opened) and `fake_door_click` (Upgrade was pressed inside it) — the pair that was supposed to turn
"we think people want this" into a demand number per feature.

The keys: `model-selection`, `knowledge-chat`, `knowledge-edit`, `ai-improve`, `monthly-review`,
`quarterly-review`, `strategic-narrative`, `connect-data`, and `audio-memo` — which had no trigger
site at all, so it was already dead.

## Why it was retired — they measured nothing

Checked via the Statsig Console API on 2026-09-08:

- `fake_door_view::event_count` **exists**.
- `fake_door_click::event_count` **does not exist at all**.

Statsig creates a metric on an event's first log. A metric that does not exist has never been
logged. So across eight live surfaces and however many months, **no user has ever clicked Upgrade
from a fake door.** Views without a single click is not a weak signal; it is the absence of the
signal the instrument was built to capture.

Nine surfaces to maintain, every one of them a place where the product says no, returning nothing.

## The product finding — worth recording separately

`paywall_upgrade_click` is **also absent**. That is the *real* paywall — the free-tier project cap,
reached by actually trying to create a second project — and it has never converted either.

This is a product finding, not a cleanup one. It is not a reason to remove the paywall; it is a
reason to look at the paywall. Recorded here because the retirement is where it was found, and
because it changes how the fake-door result reads: the doors measured nothing, and neither does
the one real door beside them.

## The failure mode worth remembering

A fake door is an experiment, and an experiment has an end date. These had none. The instrument
kept collecting `fake_door_view` — a number that always goes up, and therefore always looks like
data — while the one measurement that would have decided anything, the click, sat at zero
unexamined for months. Nothing was broken, so nothing surfaced it.

**A fake door with no scheduled read is a cost with a decorative dashboard.** If demand is worth
testing, the date you will look at the result is part of the test.

Two whole surfaces went with the doors, and one of them shows the second-order cost:

- `/project/[id]/outcomes`, 159 lines, linked from nowhere and composed entirely of four fake
  doors.
- The "Refine this summary" popover in the knowledgebase panel. Both its options were fake doors,
  so the control could not do its own job — **worse than no control**, because it invites the user
  to try and then says no.

## What stayed

- **`unlimited-projects`** — not a fake door. It is the real free-tier cap, reached by actually
  trying to create a second project, and it reports through `paywall_prompt_view` /
  `paywall_upgrade_click`. With it alone in the registry the event branching in `ProUpgradeFlow`
  collapses.
- **`ProUpgradeFlow`** and its dialogs — still live, now serving the one real paywall.

## Deleted

| path | what went |
|---|---|
| `src/app/project/[id]/outcomes/page.tsx` | the whole route, 159 lines |
| `src/components/KnowledgeSummaryPanel.tsx` | the "Refine this summary" popover and its two fake doors |
| `src/components/ProUpgradeFlow.tsx` | the `fake_door_*` branch of the event logic |
| `src/app/project/[id]/template/page.tsx`, `src/app/project/[id]/page.tsx` | remaining trigger sites |
| `docs/architecture/analytics-events.md` | `fake_door_view` / `fake_door_click` moved to Deprecated |

280 lines out, 41 in.

## See also

- `docs/architecture/analytics-events.md` → **Deprecated events**, which carries the same Statsig
  evidence in the event catalog.
- `docs/architecture/retired-extraction-run.md` — the other retirement from the same review day.
