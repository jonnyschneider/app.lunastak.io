// @vitest-environment node
/**
 * POST /api/feedback — anonymous-capable, but identity comes from the request, never the body.
 *
 * Until 2026-09-11 the route stored whatever `userId` the body carried, so anyone could file
 * feedback as any user (and a row's `userId` cascades with that user). Now it's the requester's id
 * from getRequester() — session or validated guest cookie — or null.
 */
import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequester: vi.fn(),
  feedbackCreate: vi.fn(async ({ data }: { data: object }) => ({ id: 'f1', ...data })),
}))

vi.mock('@/lib/auth/current-user', () => ({ getRequester: mocks.getRequester }))
vi.mock('@/lib/db', () => ({ prisma: { feedback: { create: mocks.feedbackCreate } } }))

import { POST } from '../route'
import { NextRequest } from 'next/server'

const send = (body: object) =>
  POST(new NextRequest('http://x/api/feedback', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => vi.clearAllMocks())

it('ignores a body userId when there is no requester — the row is anonymous', async () => {
  mocks.getRequester.mockResolvedValue(null)
  const res = await send({ traceId: 't1', userId: 'victim', responseText: 'hi' })
  expect(res.status).toBe(200)
  expect(mocks.feedbackCreate).toHaveBeenCalledWith({ data: { traceId: 't1', userId: null, responseText: 'hi' } })
})

it('attributes feedback to the requester, not to the body userId', async () => {
  mocks.getRequester.mockResolvedValue({ userId: 'g1', isGuest: true })
  const res = await send({ traceId: 't1', userId: 'victim', responseText: 'hi' })
  expect(res.status).toBe(200)
  expect(mocks.feedbackCreate).toHaveBeenCalledWith({ data: { traceId: 't1', userId: 'g1', responseText: 'hi' } })
})
