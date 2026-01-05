/**
 * Unit tests for Statsig user ID consistency
 *
 * Ensures the same user ID is used for:
 * - Experiment assignment (getExperimentVariant)
 * - Event logging (logStatsigEvent)
 *
 * This is critical for Statsig to connect experiment exposures with outcome events.
 */

import { getExperimentVariant, logStatsigEvent } from '@/lib/statsig'

// Track calls to Statsig SDK
const statsigCalls: { method: string; userId: string }[] = []

// Mock Statsig SDK
jest.mock('statsig-node', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getExperiment: jest.fn((user: { userID: string }) => {
      statsigCalls.push({ method: 'getExperiment', userId: user.userID })
      return {
        get: jest.fn().mockReturnValue('test-variant'),
        getRuleID: jest.fn().mockReturnValue('test-rule'),
        value: { variant: 'test-variant' }
      }
    }),
    logEvent: jest.fn((user: { userID: string }, eventName: string) => {
      statsigCalls.push({ method: 'logEvent', userId: user.userID })
    }),
    flush: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn(),
  }
}))

describe('Statsig User ID Consistency', () => {
  beforeEach(() => {
    statsigCalls.length = 0
    // Set up environment for Statsig
    process.env.STATSIG_SERVER_SECRET_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.STATSIG_SERVER_SECRET_KEY
  })

  describe('User ID format', () => {
    it('should accept database user IDs (cuid format)', async () => {
      const dbUserId = 'cmk0svgmc0000ow24xtlrib7n'

      await getExperimentVariant(dbUserId)
      await logStatsigEvent(dbUserId, 'test_event')

      expect(statsigCalls).toHaveLength(2)
      expect(statsigCalls[0].userId).toBe(dbUserId)
      expect(statsigCalls[1].userId).toBe(dbUserId)
    })

    it('should use same ID for experiment and event', async () => {
      const userId = 'test-user-123'

      await getExperimentVariant(userId)
      await logStatsigEvent(userId, 'strategy_generated', 1, { variant: 'test' })

      const experimentUserId = statsigCalls.find(c => c.method === 'getExperiment')?.userId
      const eventUserId = statsigCalls.find(c => c.method === 'logEvent')?.userId

      expect(experimentUserId).toBe(eventUserId)
    })
  })

  describe('Variant override', () => {
    it('should accept variant override without affecting user ID', async () => {
      const userId = 'user-abc'

      const variant = await getExperimentVariant(userId, 'dimension-guided-e3')

      expect(variant).toBe('dimension-guided-e3')
      expect(statsigCalls).toHaveLength(0) // Override bypasses Statsig call
    })

    it('should call Statsig when no override provided', async () => {
      const userId = 'user-xyz'

      await getExperimentVariant(userId)

      expect(statsigCalls).toHaveLength(1)
      expect(statsigCalls[0].method).toBe('getExperiment')
      expect(statsigCalls[0].userId).toBe(userId)
    })
  })

  describe('Event logging', () => {
    it('should log events with correct user ID', async () => {
      const userId = 'cmk0ezdcc0000p18oa2yhqk22'

      await logStatsigEvent(userId, 'strategy_generated', 1, { variant: 'baseline-v1' })

      expect(statsigCalls).toHaveLength(1)
      expect(statsigCalls[0]).toEqual({
        method: 'logEvent',
        userId: userId
      })
    })

    it('should log dimensional_coverage event with correct user ID', async () => {
      const userId = 'cmk0s73qi0000iper7hd6recm'

      await logStatsigEvent(userId, 'dimensional_coverage', 90, {
        variant: 'dimension-guided-e3',
        dimensionsCovered: '9',
        gaps: 'risks_and_constraints'
      })

      expect(statsigCalls[0].userId).toBe(userId)
    })
  })

  describe('ID consistency across flow', () => {
    it('should use consistent ID from experiment to event', async () => {
      // Simulate the full flow: experiment assignment -> event logging
      const databaseUserId = 'cmk0abc123'

      // 1. Get experiment variant (at conversation start)
      await getExperimentVariant(databaseUserId)

      // 2. Log event (at strategy generation)
      await logStatsigEvent(databaseUserId, 'strategy_generated', 1, { variant: 'test' })

      // Verify both calls used the same ID
      expect(statsigCalls[0].userId).toBe(databaseUserId)
      expect(statsigCalls[1].userId).toBe(databaseUserId)
    })

    it('should NOT use timestamp-based guest IDs', async () => {
      // This was the old buggy behavior - using guest_${Date.now()}
      const timestampGuestId = `guest_${Date.now()}`
      const databaseGuestId = 'cmk0guestuser123'

      // The database ID should be used, not the timestamp ID
      await getExperimentVariant(databaseGuestId)

      expect(statsigCalls[0].userId).toBe(databaseGuestId)
      expect(statsigCalls[0].userId).not.toMatch(/^guest_\d+$/)
    })
  })
})

describe('Edge cases', () => {
  beforeEach(() => {
    statsigCalls.length = 0
    process.env.STATSIG_SERVER_SECRET_KEY = 'test-key'
  })

  it('should handle missing STATSIG_SERVER_SECRET_KEY gracefully for events', async () => {
    delete process.env.STATSIG_SERVER_SECRET_KEY

    // Should not throw
    await logStatsigEvent('user-123', 'test_event')

    // Should not have called Statsig
    expect(statsigCalls).toHaveLength(0)
  })

  it('should return baseline variant when Statsig unavailable', async () => {
    delete process.env.STATSIG_SERVER_SECRET_KEY

    const variant = await getExperimentVariant('user-123')

    expect(variant).toBe('baseline-v1')
  })

  it('should reject invalid variant overrides', async () => {
    const variant = await getExperimentVariant('user-123', 'invalid-variant')

    // Should call Statsig instead of using invalid override
    expect(statsigCalls).toHaveLength(1)
  })
})
