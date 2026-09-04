/**
 * PROTOTYPE: ground truth check (phase 1 — fragments).
 *
 * Throwaway. No DB, no writes, no pipeline, no schema. The fixture is REAL output from the
 * 2026-09-04 excerpt spikes (§14, §15) — real claims, real verbatim excerpts, real types,
 * honest per-row verification states.
 *
 * Exists to answer what the architecture cannot: what a row looks like, whether the tranche
 * walk holds attention across 50+ items, and — the instrumented A/B — whether the user's own
 * words or our reading should lead the row.
 */
import fixture from './fixture.json'
import { GroundTruthCheck, type Fixture } from './check'

export const metadata = { title: 'Prototype — ground truth check' }

export default function GroundTruthCheckPage() {
  return <GroundTruthCheck fixture={fixture as Fixture} />
}
