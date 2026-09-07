/**
 * PROTOTYPE: ground truth gate. Disposable — exists to decide layout, affordances and editing
 * against real components before implementation.
 *
 * Design: docs/_plans/2026-09-06-ground-truth-gate-interaction-design.md
 * Fixture: real material — a real bundle (42 themes) plus two real documents, support computed
 * with the measured 40-char threshold, and three fragments modelling the pre-change state every
 * existing project will be in on day one.
 */
import fixture from './fixture.json'
import { GroundTruthGate, type Fixture } from './gate'

export const metadata = { title: 'Prototype — ground truth gate' }

export default function GroundTruthGatePage() {
  return <GroundTruthGate fixture={fixture as Fixture} />
}
