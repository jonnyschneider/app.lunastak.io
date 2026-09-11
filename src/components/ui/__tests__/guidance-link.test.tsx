import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuidanceLink } from '../guidance-link'

describe('GuidanceLink', () => {
  it('shows the short label, carries the long form for assistive tech, and acts on click', () => {
    const onClick = vi.fn()
    render(<GuidanceLink label="5 changes since v3" detail="4 ground truths added, 1 discarded since Version 3" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /4 ground truths added, 1 discarded since Version 3/ })
    expect(button).toHaveTextContent('5 changes since v3')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has no dismiss control — it is state, shown while true', () => {
    render(<GuidanceLink label="1 change since v2" />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
