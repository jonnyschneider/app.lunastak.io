/**
 * PROTOTYPE: Ground truth preflight (Phase 1).
 *
 * Throwaway. No DB, no writes, no pipeline, no schema — a JSON fixture of real
 * full_synthesis output stands in for the emission this design would need.
 * Exists to answer the five pre-registered questions in
 * docs/_plans/2026-08-27-ground-truth-preflight-design.md §7, and then be deleted.
 */
import fixture from './fixture.json'
import { GroundTruthPreflight, type Fixture } from './preflight'

export const metadata = { title: 'Prototype — ground truth preflight' }

export default function GroundTruthPrototypePage() {
  // The fixture is generated JSON; its literal types widen to string on import.
  return <GroundTruthPreflight fixture={fixture as Fixture} />
}
