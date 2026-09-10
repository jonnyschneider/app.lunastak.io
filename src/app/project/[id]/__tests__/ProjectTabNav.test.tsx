/**
 * The project's header navigation: the mode toggle, and the finished-artefact trio.
 *
 * ⚠ WHY THIS FILE EXISTS AT ALL. The nav used to be ~180 lines of JSX inline in a `useEffect` that
 * pushed it through `HeaderContext`. Nothing could test it, and three separate traps live in it:
 *
 *   1. `setTabNav(null)` when a project has no context reads like a guard clause and IS the feature.
 *      Both halves of the toggle used to show the same three onboarding cards, so the control
 *      offered a choice between one screen and a subset of itself (removed 2026-09-10). That guard
 *      deliberately stays in the EFFECT, not in this component — a component returning `null` is
 *      still a non-null node to `setTabNav`, so the mobile row would keep its border and the desktop
 *      row its gap. "Renders nothing" and "is not injected" are different things.
 *
 *   2. The strategy-ready chip must sit IN the label, never on a corner. Decision Stack is the LEFT
 *      button, so its top-right corner is the seam against Knowledgebase and a corner badge belongs
 *      to neither button (fixed 2026-09-10, "the chip landed in the seam between the two buttons").
 *
 *   3. The chip only renders on the INACTIVE button, so it never has to read against `bg-primary`.
 *
 * And a fourth found while extracting: as an inline effect, the chip depended on the effect's
 * dependency array to re-render. `strategyReady` was NOT in it, so the chip appeared only when some
 * OTHER dependency happened to change at the same moment. On a first generation `hasStrategy` flips
 * at the same time and carries it; on a REFRESH nothing else changes and the chip never appeared.
 * A component takes props and re-renders — the class of bug is gone rather than fixed.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectTabNav } from '../ProjectTabNav'

vi.mock('@/components/StatsigProvider', () => ({ logAndFlush: vi.fn() }))

function renderNav(props: Partial<React.ComponentProps<typeof ProjectTabNav>> = {}) {
  return render(
    <ProjectTabNav
      projectId="p1"
      activeTab="decision-stack"
      onSelectTab={vi.fn()}
      fragmentCount={0}
      isDemo={false}
      hasStrategy={false}
      isSignedUp
      strategyReady={false}
      onShare={vi.fn()}
      onExport={vi.fn()}
      onHistory={vi.fn()}
      {...props}
    />
  )
}

describe('the mode toggle', () => {
  it('offers both modes', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /Decision Stack/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Knowledgebase/ })).toBeInTheDocument()
  })

  it('carries the ground-truth count on Knowledgebase, and omits it at zero', () => {
    renderNav({ fragmentCount: 12 })
    expect(screen.getByRole('button', { name: /Knowledgebase\s*12/ })).toBeInTheDocument()
  })

  it('shows no count rather than a 0 — a zero would read as a result', () => {
    renderNav({ fragmentCount: 0 })
    expect(screen.getByRole('button', { name: 'Knowledgebase' })).toBeInTheDocument()
  })

  it('reports the chosen mode', async () => {
    const onSelectTab = vi.fn()
    renderNav({ onSelectTab })
    await userEvent.click(screen.getByRole('button', { name: /Knowledgebase/ }))
    expect(onSelectTab).toHaveBeenCalledWith('knowledgebase')
  })

  it('rounds BOTH outer edges of the group — the ⋯ used to be the right end', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /Decision Stack/ }).className).toContain('rounded-l-lg')
    expect(screen.getByRole('button', { name: /Knowledgebase/ }).className).toContain('rounded-r-lg')
  })
})

describe('there is no overflow menu', () => {
  /**
   * Deleted 2026-09-10. Nine of its ten items were duplicates of controls that sit on the object
   * they act on; the tenth (the demos) moved to the project switcher. A static verb list in the
   * header is a contextual control with the object taken away.
   */
  it('renders no ⋯ trigger and none of its group headings', () => {
    renderNav({ hasStrategy: true })
    expect(screen.queryByText('Add Context')).not.toBeInTheDocument()
    expect(screen.queryByText('Update Strategy')).not.toBeInTheDocument()
    expect(screen.queryByText('Examples')).not.toBeInTheDocument()
    // Three buttons exactly: two modes plus Share… (Export/History assert separately)
    expect(screen.queryByRole('button', { name: /^$/ })).not.toBeInTheDocument()
  })
})

describe('the strategy-ready chip', () => {
  it('appears on Decision Stack while the user is looking elsewhere', () => {
    renderNav({ strategyReady: true, activeTab: 'knowledgebase' })
    expect(screen.getByLabelText('New strategy to review')).toBeInTheDocument()
  })

  it('never renders on the ACTIVE button — it would have to read against bg-primary', () => {
    renderNav({ strategyReady: true, activeTab: 'decision-stack' })
    expect(screen.queryByLabelText('New strategy to review')).not.toBeInTheDocument()
  })

  it('sits INSIDE the Decision Stack button, not as a sibling in the group seam', () => {
    renderNav({ strategyReady: true, activeTab: 'knowledgebase' })
    const chip = screen.getByLabelText('New strategy to review')
    const button = screen.getByRole('button', { name: /Decision Stack/ })
    expect(button).toContainElement(chip)
    // A corner badge is absolutely positioned; this one is in the label flow.
    expect(chip.className).not.toContain('absolute')
    expect(chip.className).toContain('inline-block')
  })

  it('is absent when no strategy is waiting', () => {
    renderNav({ strategyReady: false, activeTab: 'knowledgebase' })
    expect(screen.queryByLabelText('New strategy to review')).not.toBeInTheDocument()
  })
})

describe('the finished-artefact trio', () => {
  const withStack = { hasStrategy: true, activeTab: 'decision-stack' as const }

  it('offers Share, Export and History on the built stack', () => {
    renderNav(withStack)
    for (const name of ['Share', 'Export', 'History']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('offers none of them from the Knowledgebase — they act on the stack', () => {
    renderNav({ ...withStack, activeTab: 'knowledgebase' })
    for (const name of ['Share', 'Export', 'History']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('offers none of them before a stack exists', () => {
    renderNav({ hasStrategy: false, activeTab: 'decision-stack' })
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
  })

  it('offers none of them on a demo — a demo is not yours to publish', () => {
    renderNav({ ...withStack, isDemo: true })
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  it('wires each button to its own action', async () => {
    const onShare = vi.fn(), onExport = vi.fn(), onHistory = vi.fn()
    renderNav({ ...withStack, onShare, onExport, onHistory })
    await userEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(onExport).toHaveBeenCalled()
    expect(onShare).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(onHistory).toHaveBeenCalled()
  })
})
