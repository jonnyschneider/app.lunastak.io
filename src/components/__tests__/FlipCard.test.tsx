/**
 * The edit affordance lives on the disclosure strip, not behind the flip.
 *
 * 2026-08-27: editing was reachable only from the BACK face — you had to press
 * "See the thinking" and then press Edit. Backwards: editing is a front-face
 * intent, and the flip is about reading the reasoning, not about acting on it.
 *
 * Edit now sits on the strip beside the disclosure label, so it is one press
 * from EITHER face. Two constraints the strip must keep while carrying it:
 *
 *   - The page dots stay centred. They are the only signal of which-of-two, and
 *     they must not shift when an edit control appears beside them.
 *   - Pressing Edit must NOT flip the card. The strip used to be a single
 *     button; the edit control is a sibling, and a stray flip on the way into
 *     the editor would be a jarring double state change.
 *
 * Read-only stacks (a shared link) pass no `onEditClick` and must get no button.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlipCard } from '../FlipCard'

vi.mock('@/components/StatsigProvider', () => ({
  logAndFlush: vi.fn(),
}))

const FRONT = 'the front face'
const BACK = 'the back face'

function renderCard(props: Partial<React.ComponentProps<typeof FlipCard>> = {}) {
  return render(
    <FlipCard
      front={<p>{FRONT}</p>}
      back={<p>{BACK}</p>}
      disclosureLabel="See the thinking"
      returnLabel="Back to the vision"
      {...props}
    />,
  )
}

describe('FlipCard — edit on the disclosure strip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders an edit control on the strip when editing is allowed', () => {
    renderCard({ onEditClick: vi.fn() })
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('renders NO edit control when the card is read-only', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('offers edit from the FRONT face, without flipping first', async () => {
    const onEditClick = vi.fn()
    const user = userEvent.setup()
    renderCard({ onEditClick })

    // Front is showing; the disclosure control still offers to reveal the back.
    expect(screen.getByRole('button', { name: /see the thinking/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEditClick).toHaveBeenCalledTimes(1)
  })

  it('does not flip the card when edit is pressed', async () => {
    const user = userEvent.setup()
    renderCard({ onEditClick: vi.fn() })

    const disclosure = screen.getByRole('button', { name: /see the thinking/i })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(screen.getByRole('button', { name: /see the thinking/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('still offers edit once the card is flipped to the back', async () => {
    const onEditClick = vi.fn()
    const user = userEvent.setup()
    renderCard({ onEditClick })

    await user.click(screen.getByRole('button', { name: /see the thinking/i }))
    expect(screen.getByRole('button', { name: /back to the vision/i })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEditClick).toHaveBeenCalledTimes(1)
  })

  it('keeps the disclosure control flipping the card', async () => {
    const user = userEvent.setup()
    renderCard({ onEditClick: vi.fn() })

    await user.click(screen.getByRole('button', { name: /see the thinking/i }))
    expect(screen.getByRole('button', { name: /back to the vision/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders the edit control OUTSIDE the disclosure button — a button cannot nest', () => {
    renderCard({ onEditClick: vi.fn() })
    const disclosure = screen.getByRole('button', { name: /see the thinking/i })
    const edit = screen.getByRole('button', { name: /edit/i })
    expect(disclosure.contains(edit)).toBe(false)
  })
})
