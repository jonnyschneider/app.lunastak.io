import { describe, it, expect } from 'vitest'
import { mintShareToken, isValidShareTokenFormat } from '@/lib/share'

describe('mintShareToken', () => {
  it('produces a 32-char base64url token (192 bits of entropy)', () => {
    const token = mintShareToken()
    expect(token).toHaveLength(32)
    // base64url alphabet only — must be URL-safe with no padding
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => mintShareToken()))
    expect(tokens.size).toBe(1000)
  })
})

describe('isValidShareTokenFormat', () => {
  it('accepts a minted token', () => {
    expect(isValidShareTokenFormat(mintShareToken())).toBe(true)
  })

  it('rejects wrong length, empty, and non-base64url input', () => {
    expect(isValidShareTokenFormat('')).toBe(false)
    expect(isValidShareTokenFormat('short')).toBe(false)
    expect(isValidShareTokenFormat('a'.repeat(33))).toBe(false)
    expect(isValidShareTokenFormat('!'.repeat(32))).toBe(false)
    // SQL-ish / path-traversal-ish inputs never reach the DB as valid tokens
    expect(isValidShareTokenFormat("' OR 1=1 --".padEnd(32, 'x'))).toBe(false)
    expect(isValidShareTokenFormat('../'.repeat(10) + 'xx')).toBe(false)
  })
})
