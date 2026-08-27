import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewPass, type ReviewItem } from '../review-pass'

const items: ReviewItem[] = [
  { id: 'a', statement: 'Builders keep estimates opaque', receipt: 'they carry it as a provisional sum', group: 'Go To Market' },
  { id: 'b', statement: 'The buyer identity is unsettled', group: 'Customer & Market' },
  { id: 'c', statement: 'Joinery is a quarter of a renovation', receipt: 'a big line item', group: 'Customer & Market' },
]

const copy = {
  intro: 'Confirm your ground truths',
  itemPrompt: 'What I took from your material',
  remarkPrompt: 'something else?',
}

function setup(props: Partial<React.ComponentProps<typeof ReviewPass>> = {}) {
  const onRule = vi.fn().mockResolvedValue(undefined)
  const onBatchEnd = vi.fn()
  render(<ReviewPass items={items} copy={copy} onRule={onRule} onBatchEnd={onBatchEnd} {...props} />)
  return { onRule, onBatchEnd, user: userEvent.setup() }
}

describe('ReviewPass', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows one item at a time, with its group and position', () => {
    setup()
    expect(screen.getByText('Builders keep estimates opaque')).toBeInTheDocument()
    expect(screen.queryByText('The buyer identity is unsettled')).not.toBeInTheDocument()
    expect(screen.getByText(/Go To Market/)).toBeInTheDocument()
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument()
  })

  it('offers exactly the three verdicts', () => {
    setup()
    expect(screen.getByRole('button', { name: /^Yes$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^No$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Not quite right/ })).toBeInTheDocument()
  })

  it('fires onRule per item and advances', async () => {
    const { onRule, user } = setup()
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    await waitFor(() => expect(onRule).toHaveBeenCalledWith('a', 'yes', undefined))
    expect(screen.getByText('The buyer identity is unsettled')).toBeInTheDocument()
  })

  it('does not advance past a ruling that failed to save', async () => {
    const onRule = vi.fn().mockRejectedValue(new Error('offline'))
    render(<ReviewPass items={items} copy={copy} onRule={onRule} onBatchEnd={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('Builders keep estimates opaque')).toBeInTheDocument()
  })

  it('keeps the receipt collapsed until asked for', async () => {
    const { user } = setup()
    expect(screen.queryByText(/provisional sum/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /because you said/i }))
    expect(screen.getByText(/provisional sum/)).toBeInTheDocument()
  })

  it('reports each receipt reveal to the host', async () => {
    const onReveal = vi.fn()
    const { user } = setup({ onReveal })
    await user.click(screen.getByRole('button', { name: /because you said/i }))
    expect(onReveal).toHaveBeenCalledWith('a')
    // Collapsing and re-opening the same receipt is not a second reveal.
    await user.click(screen.getByRole('button', { name: /because you said/i }))
    await user.click(screen.getByRole('button', { name: /because you said/i }))
    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it('omits the receipt control entirely when there is nothing to show', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    await screen.findByText('The buyer identity is unsettled')
    expect(screen.queryByRole('button', { name: /because you said/i })).not.toBeInTheDocument()
  })

  it('demotes the remark: a link, not an open field', async () => {
    const { user } = setup()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'something else?' }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('passes the remark through with the verdict', async () => {
    const { onRule, user } = setup()
    await user.click(screen.getByRole('button', { name: 'something else?' }))
    await user.type(screen.getByRole('textbox'), 'More like they want to export from it')
    await user.click(screen.getByRole('button', { name: /Not quite right/ }))
    await waitFor(() =>
      expect(onRule).toHaveBeenCalledWith('a', 'not_quite', 'More like they want to export from it')
    )
  })

  it('clears the remark between items', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'something else?' }))
    await user.type(screen.getByRole('textbox'), 'a remark')
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    await screen.findByText('The buyer identity is unsettled')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('pauses at the batch boundary and reports progress, without ending the pass', async () => {
    const { onBatchEnd, user } = setup({ batchSize: 2 })
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    await screen.findByText('The buyer identity is unsettled')
    await user.click(screen.getByRole('button', { name: /^No$/ }))
    await waitFor(() =>
      expect(onBatchEnd).toHaveBeenCalledWith({ reviewed: 2, total: 3, remaining: 1, complete: false })
    )
    expect(screen.queryByText('Joinery is a quarter of a renovation')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /keep going/i }))
    expect(screen.getByText('Joinery is a quarter of a renovation')).toBeInTheDocument()
  })

  it('reports completion when the last item is ruled', async () => {
    const { onBatchEnd, user } = setup({ batchSize: 10 })
    for (const _ of items) {
      await user.click(screen.getByRole('button', { name: /^Yes$/ }))
      await waitFor(() => {})
    }
    await waitFor(() =>
      expect(onBatchEnd).toHaveBeenCalledWith({ reviewed: 3, total: 3, remaining: 0, complete: true })
    )
  })

  it('walks a fixed list even if the host re-derives items from the rulings', async () => {
    // A host that filters already-ruled items out of `items` shrinks the prop
    // under the walk. Advancing an index into a shrinking list skips items —
    // silently, which is the worst way to lose someone's review.
    function Host() {
      const [ruled, setRuled] = React.useState<string[]>([])
      return (
        <ReviewPass
          items={items.filter((i) => !ruled.includes(i.id))}
          copy={copy}
          onRule={async (id) => setRuled((prev) => [...prev, id])}
          onBatchEnd={vi.fn()}
        />
      )
    }
    render(<Host />)
    const user = userEvent.setup()
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    expect(await screen.findByText('The buyer identity is unsettled')).toBeInTheDocument()
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Yes$/ }))
    expect(await screen.findByText('Joinery is a quarter of a renovation')).toBeInTheDocument()
    expect(screen.getByText(/3 of 3/)).toBeInTheDocument()
  })

  it('renders nothing to rule when handed an empty list', () => {
    render(<ReviewPass items={[]} copy={copy} onRule={vi.fn()} onBatchEnd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Yes$/ })).not.toBeInTheDocument()
  })
})
