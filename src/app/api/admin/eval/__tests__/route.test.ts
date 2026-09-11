// @vitest-environment node
/**
 * /api/admin/eval* — a local eval viewer that reads and WRITES files under `evals/`. It had no
 * auth at all until 2026-09-11; it now carries the same production guard as the dev/* routes, so
 * on production it answers 403 before touching the filesystem.
 */
import { vi } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
}))

import * as fs from 'fs'
import { GET as list } from '../route'
import { GET as getOne, PUT as putOne } from '../[evalId]/route'

const params = { params: Promise.resolve({ evalId: 'e1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', 'production')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const fsTouched = () =>
  [fs.existsSync, fs.readdirSync, fs.readFileSync, fs.writeFileSync].some(fn => vi.mocked(fn).mock.calls.length > 0)

it('GET list → 403 on production, without reading the filesystem', async () => {
  expect((await list()).status).toBe(403)
  expect(fsTouched()).toBe(false)
})

it('GET one → 403 on production, without reading the filesystem', async () => {
  expect((await getOne(new Request('http://x/api/admin/eval/e1') as never, params)).status).toBe(403)
  expect(fsTouched()).toBe(false)
})

it('PUT one → 403 on production, without writing the filesystem', async () => {
  const req = new Request('http://x/api/admin/eval/e1', { method: 'PUT', body: JSON.stringify({ summary: 'x' }) })
  expect((await putOne(req as never, params)).status).toBe(403)
  expect(fsTouched()).toBe(false)
})
