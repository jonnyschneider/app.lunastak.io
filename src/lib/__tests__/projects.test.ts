/**
 * Unit tests for guest user isolation
 * Tests the projects.ts functions for creating and identifying guest users/projects
 */

import { isGuestUser } from '@/lib/projects'

// Mock Prisma for database operations
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    project: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    conversation: {
      updateMany: vi.fn(),
    },
    trace: {
      updateMany: vi.fn(),
    },
    dimensionalSynthesis: {
      createMany: vi.fn(),
    },
  },
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
      vi.clearAllMocks()
    })

    it('should create user with guest email pattern', async () => {
      const { prisma } = await import('@/lib/db')
      const mockUser = {
        id: 'test-user-id',
        email: 'guest_abc123@guest.lunastak.io',
      }
      ;(prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

      const { createGuestUser } = await import('@/lib/projects')
      const result = await createGuestUser()

      expect(prisma.user.create).toHaveBeenCalledTimes(1)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: expect.stringMatching(/^guest_[a-f0-9]+@guest\.lunastak\.io$/),
        },
      })
    })

    it('should generate unique IDs for each guest', async () => {
      const { prisma } = await import('@/lib/db')
      const emails: string[] = []

      ;(prisma.user.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }: any) => {
        emails.push(data.email)
        return Promise.resolve({ id: 'id', email: data.email })
      })

      const { createGuestUser } = await import('@/lib/projects')
      await createGuestUser()
      await createGuestUser()
      await createGuestUser()

      // All emails should be unique
      expect(new Set(emails).size).toBe(3)
    })
  })

  describe('getOrCreateDefaultProject', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.resetModules()
    })

    it('should create guest user with empty project when userId is null', async () => {
      const { prisma } = await import('@/lib/db')
      const mockGuestUser = { id: 'guest-user-id', email: 'guest_abc@guest.lunastak.io' }
      const mockProject = { id: 'empty-project-id', name: 'My Strategy', userId: 'guest-user-id' }

      ;(prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuestUser)
      ;(prisma.project.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject)
      ;(prisma.dimensionalSynthesis.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 11 })
      ;(prisma.project.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject)

      const { getOrCreateDefaultProject } = await import('@/lib/projects')
      const result = await getOrCreateDefaultProject(null)

      expect(result.isGuest).toBe(true)
      expect(result.userId).toBe('guest-user-id')
      expect(result.project.id).toBe('empty-project-id')
      // Should create empty project, not seed demo
      expect(prisma.project.create).toHaveBeenCalled()
      expect(prisma.dimensionalSynthesis.createMany).toHaveBeenCalled()
    })

    it('should return existing project for authenticated user', async () => {
      const { prisma } = await import('@/lib/db')
      const mockProject = { id: 'existing-project', name: 'My Strategy', userId: 'auth-user-id' }

      ;(prisma.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject)

      const { getOrCreateDefaultProject } = await import('@/lib/projects')
      const result = await getOrCreateDefaultProject('auth-user-id')

      expect(result.isGuest).toBe(false)
      expect(result.userId).toBe('auth-user-id')
      expect(result.project.id).toBe('existing-project')
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('should create new project for authenticated user without existing project', async () => {
      const { prisma } = await import('@/lib/db')
      const mockProject = { id: 'new-project', name: 'My Strategy', userId: 'auth-user-id' }

      ;(prisma.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      ;(prisma.project.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject)

      const { getOrCreateDefaultProject } = await import('@/lib/projects')
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
