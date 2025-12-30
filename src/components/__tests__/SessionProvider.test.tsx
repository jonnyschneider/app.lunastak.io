import { render } from '@testing-library/react'
import { SessionProvider } from '../SessionProvider'

// Mock NextAuth SessionProvider
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children, session }: any) => (
    <div data-testid="next-auth-provider" data-session={JSON.stringify(session)}>
      {children}
    </div>
  ),
}))

describe('SessionProvider', () => {
  it('renders with null session', () => {
    const { getByTestId } = render(
      <SessionProvider session={null}>
        <div>Child content</div>
      </SessionProvider>
    )

    const provider = getByTestId('next-auth-provider')
    expect(provider.getAttribute('data-session')).toBe('null')
  })

  it('renders with valid session', () => {
    const session = {
      user: { id: 'user-1', email: 'test@example.com' },
      expires: '2025-12-31'
    }

    const { getByTestId } = render(
      <SessionProvider session={session}>
        <div>Child content</div>
      </SessionProvider>
    )

    const provider = getByTestId('next-auth-provider')
    expect(provider.getAttribute('data-session')).toContain('user-1')
  })

  it('passes session prop to NextAuth SessionProvider', () => {
    const session = {
      user: { id: 'user-2', name: 'Test User' },
      expires: '2025-12-31'
    }

    const { getByTestId } = render(
      <SessionProvider session={session}>
        <div>Test</div>
      </SessionProvider>
    )

    const provider = getByTestId('next-auth-provider')
    const sessionData = JSON.parse(provider.getAttribute('data-session') || '{}')

    expect(sessionData.user.id).toBe('user-2')
    expect(sessionData.user.name).toBe('Test User')
  })
})
