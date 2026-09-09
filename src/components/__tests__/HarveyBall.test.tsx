import * as React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HarveyBall } from '../KnowledgeSummaryPanel'

/**
 * The ball renders computed support (design §16.4) — five states, not the four it had while its
 * input was a confidence string. `three-quarter` is the new one.
 */
function ball(support: React.ComponentProps<typeof HarveyBall>['support']) {
  const { container } = render(<HarveyBall support={support} />)
  return container.querySelector('svg')!
}

describe('HarveyBall', () => {
  it('renders every support level, and labels which one', () => {
    for (const level of ['empty', 'quarter', 'half', 'three-quarter', 'full'] as const) {
      expect(ball(level).getAttribute('data-support')).toBe(level)
    }
  })

  it('draws empty as an outline with nothing filled', () => {
    const svg = ball('empty')
    expect(svg.querySelectorAll('path')).toHaveLength(0)
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe('none')
  })

  it('draws full as a solid circle with no wedge', () => {
    const svg = ball('full')
    expect(svg.querySelectorAll('path')).toHaveLength(0)
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe('currentColor')
  })

  it('draws quarter, half and three-quarter as a filled wedge on an outline', () => {
    for (const level of ['quarter', 'half', 'three-quarter'] as const) {
      const svg = ball(level)
      expect(svg.querySelector('circle')!.getAttribute('fill')).toBe('none')
      expect(svg.querySelectorAll('path')).toHaveLength(1)
    }
  })

  it('draws three-quarter with the large-arc flag, sweeping past the half it extends', () => {
    // half: a 180° arc (large-arc 0); three-quarter: the same start, 270° round (large-arc 1)
    const halfD = ball('half').querySelector('path')!.getAttribute('d')!
    const threeQuarterD = ball('three-quarter').querySelector('path')!.getAttribute('d')!
    expect(halfD).toContain('0 0 0')
    expect(threeQuarterD).toContain('0 1 0')
    // same starting point: both begin at the top of the circle
    expect(threeQuarterD.split('A')[0]).toBe(halfD.split('A')[0])
  })
})
