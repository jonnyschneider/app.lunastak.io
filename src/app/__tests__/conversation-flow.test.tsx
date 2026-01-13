import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomePage } from '@/components/HomePage'

// Mock fetch globally
global.fetch = jest.fn()

// Mock next-auth session
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

// Mock AppLayout to avoid sidebar complexities
jest.mock('@/components/layout/app-layout', () => ({
  AppLayout: ({ children }: any) => <div data-testid="app-layout">{children}</div>,
}))

describe('Conversation Start Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('starts conversation and transitions to chat', async () => {
    const user = userEvent.setup()

    // Mock conversation start API
    ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          conversationId: 'conv-123',
          message: 'What are you working on?',
          stepNumber: 1,
          experimentVariant: 'baseline-v1',
        }),
      })
    )

    // Mock events API
    ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      })
    )

    render(<HomePage session={null} />)

    // Click "Guided Conversation" entry point
    const guidedButton = screen.getByText(/Guided Conversation/i)
    await user.click(guidedButton)

    // Wait for conversation to start
    await waitFor(() => {
      expect(screen.getByText('What are you working on?')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify conversation start API was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/conversation/start',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Verify events API was called with correct conversationId
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('conv-123'),
      })
    )
  })

  it('handles conversation start failure gracefully', async () => {
    const user = userEvent.setup()

    // Mock conversation start API failure
    ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('Network error'))
    )

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    render(<HomePage session={null} />)

    const guidedButton = screen.getByText(/Guided Conversation/i)
    await user.click(guidedButton)

    // Wait a bit for error handling
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to start conversation:',
        expect.any(Error)
      )
    })

    // Events API should not be called if conversation start failed
    expect(global.fetch).toHaveBeenCalledTimes(1)

    consoleErrorSpy.mockRestore()
  })

  it('does not log event if conversationId is missing', async () => {
    const user = userEvent.setup()

    // Mock conversation start API returning no conversationId
    ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          message: 'What are you working on?',
          stepNumber: 1,
          // Missing conversationId
        }),
      })
    )

    render(<HomePage session={null} />)

    const guidedButton = screen.getByText(/Guided Conversation/i)
    await user.click(guidedButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Events API should not be called without conversationId
    const eventsCalls = (global.fetch as jest.Mock).mock.calls.filter(
      call => call[0] === '/api/events'
    )
    expect(eventsCalls).toHaveLength(0)
  })
})
