// @vitest-environment node
/**
 * Every route that takes a conversation id checks the caller owns it — before any LLM spend.
 *
 * Until 2026-09-11 (auth-gap inventory) these took the id alone: a known cuid was enough to read a
 * conversation's fragments, append a turn to it, or run extraction on it — and `continue`, `extract`
 * and `generate` spend LLM calls, billed against whoever owns the conversation. The write routes
 * gate at `write` access so a demo project's viewer can read its conversations but not spend on them.
 *
 * `conversation/[id]` GET/PATCH have their own test next to the route.
 */
import { vi } from 'vitest'

// `vi.hoisted` because vi.mock factories are lifted above ordinary const declarations.
const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  conversationFindFirst: vi.fn(),
  // Any LLM call is a test failure: the whole point is that a denied caller spends nothing.
  createMessage: vi.fn(async () => {
    throw new Error('createMessage must not be called for a denied caller')
  }),
  checkAndIncrementGuestApiCalls: vi.fn(async () => ({ blocked: false })),
  // The routes' own data query answers for any id — a route that reaches it without the guard leaks.
  conversationFindUnique: vi.fn(async () => ({ id: 'c1', userId: 'someone-else', projectId: 'p1', messages: [] })),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { findFirst: mocks.conversationFindFirst, findUnique: mocks.conversationFindUnique, update: vi.fn() },
    fragment: { findMany: vi.fn(async () => []) },
    message: { create: vi.fn() },
  },
}))
vi.mock('@/lib/claude', () => ({ createMessage: mocks.createMessage }))
vi.mock('@/lib/projects', () => ({ checkAndIncrementGuestApiCalls: mocks.checkAndIncrementGuestApiCalls }))
vi.mock('@/lib/pipeline', () => ({ planPipeline: vi.fn(), executePipeline: vi.fn() }))
vi.mock('@/lib/decision-stack', () => ({ setGenerationStatus: vi.fn() }))
vi.mock('@/lib/statsig', () => ({ logStatsigEvent: vi.fn(async () => {}) }))
vi.mock('@/lib/knowledge-summary', () => ({ getProjectKnowledgeForPrompt: vi.fn(async () => null) }))
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))

import { GET as getSummary } from '../conversation/[id]/summary/route'
import { GET as getExtractionStatus } from '../extraction-status/[conversationId]/route'
import { POST as postContinue } from '../conversation/continue/route'
import { POST as postExtract } from '../extract/route'
import { POST as postGenerate } from '../generate/route'

const req = () => new Request('http://x/api')
const jsonReq = (body: object) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) })

const CASES = [
  ['GET conversation/[id]/summary', 'read', () => getSummary(req(), { params: Promise.resolve({ id: 'c1' }) })],
  ['GET extraction-status', 'read', () => getExtractionStatus(req(), { params: Promise.resolve({ conversationId: 'c1' }) })],
  ['POST conversation/continue', 'write', () => postContinue(jsonReq({ conversationId: 'c1', userResponse: 'hi', currentPhase: 'INITIAL' }))],
  ['POST extract', 'write', () => postExtract(jsonReq({ conversationId: 'c1' }))],
  ['POST generate', 'write', () => postGenerate(jsonReq({ conversationId: 'c1' }))],
] as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getRequester.mockResolvedValue({ userId: 'u1', isGuest: false })
  mocks.conversationFindFirst.mockResolvedValue(null)
})

describe.each(CASES)('%s', (_, access, call) => {
  it('401s an anonymous caller without touching the conversation', async () => {
    mocks.getRequester.mockResolvedValue(null)
    expect((await call()).status).toBe(401)
    expect(mocks.conversationFindFirst).not.toHaveBeenCalled()
  })

  it('404s someone else’s conversation, with no LLM spend and no quota burned', async () => {
    expect((await call()).status).toBe(404)
    expect(mocks.createMessage).not.toHaveBeenCalled()
    expect(mocks.checkAndIncrementGuestApiCalls).not.toHaveBeenCalled()
  })

  it(`checks at \`${access}\` access`, async () => {
    await call()
    const { where } = mocks.conversationFindFirst.mock.calls[0][0]
    // read honours demo projects; write is owner-only, so a demo viewer can't spend LLM on a demo.
    if (access === 'read') expect(JSON.stringify(where)).toContain('isDemo')
    else expect(JSON.stringify(where)).not.toContain('isDemo')
  })
})
