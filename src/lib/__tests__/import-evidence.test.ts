/**
 * Context-bundle imports carry evidence structurally (Task 10).
 *
 * Evidence bullets used to be flattened into the fragment's `content` as a prose
 * `Evidence:` block. They now ride the contract as `evidence[]` so
 * `createFragmentsFromImport` can write real `Evidence` rows
 * (`verification: 'unverifiable'`, `sourceRole: 'bundle'`).
 *
 * NOT A BACKFILL: fragments imported before this change keep their prose
 * `Evidence:` blocks inside `content` and have no `Evidence` rows. Only new
 * imports get structured evidence.
 *
 * The `Source: file.txt` suffix on chunk content is deliberately left alone —
 * a filename has no structured home in the schema, so removing it from
 * `content` would drop provenance entirely.
 */

const createMessageMock = vi.fn()

vi.mock('@/lib/claude', () => ({
  createMessage: (...args: unknown[]) => createMessageMock(...args),
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
}))

import type { ContextBundle } from '@/lib/import/types'

// Dynamic import for Vitest alias resolution
let transformContextBundleDirect: typeof import('@/lib/import/transforms/context-bundle').transformContextBundleDirect
let transformContextBundle: typeof import('@/lib/import/transforms/context-bundle').transformContextBundle

beforeAll(async () => {
  const mod = await import('@/lib/import/transforms/context-bundle')
  transformContextBundleDirect = mod.transformContextBundleDirect
  transformContextBundle = mod.transformContextBundle
})

/** Tag every chunk in the batch as customer_market so the LLM path is deterministic. */
function taggingResponse(count: number) {
  const chunks = Array.from({ length: count }, (_, i) =>
    `<chunk index="${i}"><dimension name="customer_market" confidence="high"/></chunk>`
  ).join('\n')
  return { content: [{ type: 'text', text: `<tagging>\n${chunks}\n</tagging>` }] }
}

beforeEach(() => {
  createMessageMock.mockReset()
})

describe('themes-mode bundle (direct transform)', () => {
  const bundle: ContextBundle = {
    version: '1',
    themes: [
      {
        area: 'CUSTOMER_MARKET',
        theme: 'Buyers are ops leads, not execs',
        evidence: ['The person who signs is never the person who uses it', 'Ops leads pick the tool'],
        confidence: 'HIGH',
      },
    ],
  }

  it('carries evidence on the contract', () => {
    const themes = transformContextBundleDirect(bundle)
    expect(themes).toHaveLength(1)
    expect(themes[0].evidence).toEqual([
      'The person who signs is never the person who uses it',
      'Ops leads pick the tool',
    ])
  })

  it('no longer flattens evidence into content', () => {
    const themes = transformContextBundleDirect(bundle)
    expect(themes[0].content).not.toContain('\nEvidence:\n')
    expect(themes[0].content).toBe('Buyers are ops leads, not execs')
  })

  it('transforms cleanly when a theme has no evidence', () => {
    const bare: ContextBundle = {
      version: '1',
      themes: [{ area: 'GO_TO_MARKET', theme: 'Channel is partner-led', confidence: 'MEDIUM' }],
    }
    const themes = transformContextBundleDirect(bare)
    expect(themes).toHaveLength(1)
    expect(themes[0].content).toBe('Channel is partner-led')
    expect(themes[0].evidence ?? []).toEqual([])
  })
})

describe('chunks-mode bundle (LLM tagging transform)', () => {
  const bundle: ContextBundle = {
    version: '2',
    chunks: [
      {
        topic: 'Buying committee',
        content: 'Ops leads drive the decision.',
        evidence: ['Ops leads drive the decision.'],
        sources: ['discovery-notes.md', 'call-2.txt'],
      },
    ],
  }

  it('carries evidence on the contract and keeps the Source suffix', async () => {
    createMessageMock.mockResolvedValue(taggingResponse(1))
    const themes = await transformContextBundle(bundle)

    expect(themes).toHaveLength(1)
    expect(themes[0].evidence).toEqual(['Ops leads drive the decision.'])
    expect(themes[0].content).not.toContain('\nEvidence:\n')
    // Source attribution stays in content — a filename has no structured home.
    expect(themes[0].content.endsWith('\n\nSource: discovery-notes.md, call-2.txt')).toBe(true)
  })

  it('transforms cleanly when a chunk has no evidence', async () => {
    createMessageMock.mockResolvedValue(taggingResponse(1))
    const themes = await transformContextBundle({
      version: '2',
      chunks: [{ topic: 'Pricing', content: 'Seat-based, annual.' }],
    })

    expect(themes).toHaveLength(1)
    expect(themes[0].content).toBe('Seat-based, annual.')
    expect(themes[0].evidence ?? []).toEqual([])
  })

  it('leaves tension fan-out without evidence', async () => {
    createMessageMock.mockResolvedValue(taggingResponse(1))
    const themes = await transformContextBundle({
      version: '2',
      chunks: [{ topic: 'Pricing', content: 'Seat-based, annual.' }],
      tensions: [{ tension: 'Speed versus rigour', areas: ['GO_TO_MARKET'] }],
    })

    const tension = themes.find(t => t.content === 'Speed versus rigour')
    expect(tension).toBeDefined()
    expect(tension!.evidence).toBeUndefined()
  })
})
