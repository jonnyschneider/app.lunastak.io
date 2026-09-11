import { describe, it, expect } from 'vitest'
import { computeStrategySync } from '../strategy-sync'

const at = (d: string) => new Date(d)
const gt = (id: string, d = '2026-09-01') => ({ id, createdAt: at(d) })

describe('computeStrategySync', () => {
  it('does NOT report system context as discarded — the gate-baseline "10 discarded" bug', () => {
    // Built from 2 ground truths + 2 bundle tensions; nothing has been discarded since.
    const tensions = [gt('t1'), gt('t2')]
    const truths = [gt('a'), gt('b')]
    const diff = computeStrategySync({
      snapshotIds: ['a', 'b', 't1', 't2'],
      snapshotAt: at('2026-09-02'),
      activeFragments: [...truths, ...tensions],
      groundTruths: truths,
    })
    expect(diff).toEqual({ addedIds: [], removedIds: [], comparable: true })
  })

  it('reports a real discard', () => {
    const diff = computeStrategySync({
      snapshotIds: ['a', 'b', 't1'],
      snapshotAt: at('2026-09-02'),
      activeFragments: [gt('a'), gt('t1')], // b discarded
      groundTruths: [gt('a')],
    })
    expect(diff.removedIds).toEqual(['b'])
  })

  it('reports additions as ground truths only', () => {
    const diff = computeStrategySync({
      snapshotIds: ['a'],
      snapshotAt: at('2026-09-02'),
      activeFragments: [gt('a'), gt('c', '2026-09-05'), gt('t9', '2026-09-05')], // t9 = new tension
      groundTruths: [gt('a'), gt('c', '2026-09-05')],
    })
    expect(diff.addedIds).toEqual(['c'])
  })

  it('a restored ground truth is no longer a change', () => {
    const diff = computeStrategySync({
      snapshotIds: ['a', 'b'],
      snapshotAt: at('2026-09-02'),
      activeFragments: [gt('a'), gt('b')],
      groundTruths: [gt('a'), gt('b')],
    })
    expect(diff.addedIds).toEqual([])
    expect(diff.removedIds).toEqual([])
  })

  it('a pre-fragmentIds snapshot sees additions by timestamp only, and says so', () => {
    const diff = computeStrategySync({
      snapshotIds: null,
      snapshotAt: at('2026-09-02'),
      activeFragments: [gt('a'), gt('c', '2026-09-05')],
      groundTruths: [gt('a'), gt('c', '2026-09-05')],
    })
    expect(diff).toEqual({ addedIds: ['c'], removedIds: [], comparable: false })
  })

  it('no snapshot at all: everything is added, nothing comparable', () => {
    const diff = computeStrategySync({ snapshotIds: null, snapshotAt: null, activeFragments: [gt('a')], groundTruths: [gt('a')] })
    expect(diff).toEqual({ addedIds: ['a'], removedIds: [], comparable: false })
  })
})
