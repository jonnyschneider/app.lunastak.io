/**
 * Unit tests for guest user isolation
 * Tests the projects.ts functions for creating and identifying guest users/projects
 */

import { isGuestUser } from '@/lib/projects'

// Mock Prisma for database operations
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    project: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    conversation: {
      updateMany: jest.fn(),
    },
    trace: {
      updateMany: jest.fn(),
    },
    dimensionalSynthesis: {
      createMany: jest.fn(),
    },
  },
}))

// Mock seedDemoProject to avoid complex fixture loading in tests
jest.mock('@/lib/seed-demo', () => ({
  seedDemoProject: jest.fn(),
}))

describe('Guest User Isolation', () => {
  describe('isGuestUser', () => {
    it('should return true for guest email pattern', () => {
      expect(isGuestUser('guest_abc123@guest.lunastak.io')).toBe(true)
      expect(isGuestUser('guest_xyz789def456@guest.lunastak.io')).toBe(true)
    })

    it('should return false for regular user emails', () => {
      expect(isGuestUser('user@example.com')).toBe(false)
      expect(isGuestUser('john@company.io')).toBe(false)
      expect(isGuestUser('admin@lunastak.io')).toBe(false)
    })

    it('should return false for emails that partially match pattern', () => {
      expect(isGuestUser('guest@example.com')).toBe(false)
      expect(isGuestUser('user@guest.lunastak.io.fake.com')).toBe(false)
      expect(isGuestUser('guest.lunastak.io')).toBe(false)
    })

    it('should handle empty string', () => {
      expect(isGuestUser('')).toBe(false)
    })
  })

  describe('createGuestUser', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should create user with guest email pattern', async () => {
      const { prisma } = require('@/lib/db')
      const mockUser = {
        id: 'test-user-id',
        email: 'guest_abc123@guest.lunastak.io',
      }
      prisma.user.create.mockResolvedValue(mockUser)

      const { createGuestUser } = require('@/lib/projects')
      const result = await createGuestUser()

      expect(prisma.user.create).toHaveBeenCalledTimes(1)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: expect.stringMatching(/^guest_[a-f0-9]+@guest\.lunastak\.io$/),
        },
      })
    })

    it('should generate unique IDs for each guest', async () => {
      const { prisma } = require('@/lib/db')
      const emails: string[] = []

      prisma.user.create.mockImplementation(({ data }: any) => {
        emails.push(data.email)
        return Promise.resolve({ id: 'id', email: data.email })
      })

      const { createGuestUser } = require('@/lib/projects')
      await createGuestUser()
      await createGuestUser()
      await createGuestUser()

      // All emails should be unique
      expect(new Set(emails).size).toBe(3)
    })
  })

  describe('getOrCreateDefaultProject', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      // Reset module to clear any cached state
      jest.resetModules()
    })

    it('should create guest user and hydrate demo project when userId is null', async () => {
      const { prisma } = require('@/lib/db')
      const { seedDemoProject } = require('@/lib/seed-demo')
      const mockGuestUser = { id: 'guest-user-id', email: 'guest_abc@guest.lunastak.io' }
      const mockProject = { id: 'demo-project-id', name: 'Demo: BuildFlow Strategy', userId: 'guest-user-id' }

      prisma.user.create.mockResolvedValue(mockGuestUser)
      seedDemoProject.mockResolvedValue('demo-project-id')
      prisma.project.findUniqueOrThrow.mockResolvedValue(mockProject)

      const { getOrCreateDefaultProject } = require('@/lib/projects')
      const result = await getOrCreateDefaultProject(null)

      expect(result.isGuest).toBe(true)
      expect(result.userId).toBe('guest-user-id')
      expect(result.project.id).toBe('demo-project-id')
      expect(seedDemoProject).toHaveBeenCalledWith('guest-user-id')
    })

    it('should return existing project for authenticated user', async () => {
      const { prisma } = require('@/lib/db')
      const mockProject = { id: 'existing-project', name: 'My Strategy', userId: 'auth-user-id' }

      prisma.project.findFirst.mockResolvedValue(mockProject)

      const { getOrCreateDefaultProject } = require('@/lib/projects')
      const result = await getOrCreateDefaultProject('auth-user-id')

      expect(result.isGuest).toBe(false)
      expect(result.userId).toBe('auth-user-id')
      expect(result.project.id).toBe('existing-project')
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('should create new project for authenticated user without existing project', async () => {
      const { prisma } = require('@/lib/db')
      const mockProject = { id: 'new-project', name: 'My Strategy', userId: 'auth-user-id' }

      prisma.project.findFirst.mockResolvedValue(null)
      prisma.project.create.mockResolvedValue(mockProject)

      const { getOrCreateDefaultProject } = require('@/lib/projects')
      const result = await getOrCreateDefaultProject('auth-user-id')

      expect(result.isGuest).toBe(false)
      expect(result.project.name).toBe('My Strategy')
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          userId: 'auth-user-id',
          name: 'My Strategy',
          status: 'active',
        },
      })
    })
  })
})
