// @vitest-environment node
/**
 * template-entry's time budget. Its pipeline plan runs `extractFromTemplate` — an LLM call — inside
 * the request's `waitUntil` (it used to be a self-fetch to a separate route, 2b675b8), so the
 * function has to live as long as that call does. Vercel caps background work at the route's
 * `maxDuration`; without one, extraction can be cut off mid-call and the template's fragments
 * silently never appear. 300 matches the other LLM routes.
 */
import { vi } from 'vitest'

vi.mock('@/lib/auth/guard', () => ({ requireProjectAccess: vi.fn(), isDenied: vi.fn() }))
vi.mock('@/lib/pipeline', () => ({ planPipeline: vi.fn(), executePipeline: vi.fn() }))

import * as route from '../route'

it('exports a maxDuration long enough for background LLM extraction', () => {
  expect((route as { maxDuration?: number }).maxDuration).toBeGreaterThanOrEqual(300)
})
