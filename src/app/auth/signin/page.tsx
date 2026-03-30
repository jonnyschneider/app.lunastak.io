'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleIcon } from '@/components/icons/google'

const oauthProviders = [
  { id: 'google', name: 'Google', icon: GoogleIcon },
] as const

function OAuthButtons({ callbackUrl }: { callbackUrl: string }) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  const handleOAuthSignIn = async (providerId: string) => {
    setLoadingProvider(providerId)
    await signIn(providerId, { callbackUrl })
  }

  return (
    <div className="space-y-3">
      {oauthProviders.map((provider) => (
        <Button
          key={provider.id}
          variant="outline"
          className="w-full"
          onClick={() => handleOAuthSignIn(provider.id)}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === provider.id ? (
            'Redirecting...'
          ) : (
            <>
              <provider.icon className="mr-2 h-5 w-5" />
              Continue with {provider.name}
            </>
          )}
        </Button>
      ))}
    </div>
  )
}

function Divider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">or</span>
      </div>
    </div>
  )
}

function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const prefilledEmail = searchParams.get('email') || ''
  const isConfirmed = searchParams.get('confirmed') === 'true'

  const [email, setEmail] = useState(prefilledEmail)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  // Auto-submit if coming from confirmation flow with pre-filled email
  useEffect(() => {
    if (isConfirmed && prefilledEmail && !emailSent && !isLoading) {
      handleAutoSubmit()
    }
  }, [isConfirmed, prefilledEmail])

  const handleAutoSubmit = async () => {
    setIsLoading(true)
    try {
      // Store guest mapping server-side before sending magic link
      fetch('/api/auth/prepare-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: prefilledEmail }),
      }).catch(() => {}) // Fire-and-forget

      const result = await signIn('email', {
        email: prefilledEmail,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError('Failed to send email. Please try again.')
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Store guest mapping server-side before sending magic link
      fetch('/api/auth/prepare-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {}) // Fire-and-forget

      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError('Failed to send email. Please try again.')
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading state when auto-submitting from confirmation
  if (isConfirmed && isLoading && !emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Email confirmed</CardTitle>
            <CardDescription>
              Sending your sign-in link...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please wait while we send a magic link to {prefilledEmail}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              A sign in link has been sent to {email || prefilledEmail}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click the link in the email to sign in. You can close this tab.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Sign in to Lunastak</CardTitle>
          <CardDescription>
            Your second brain for strategic clarity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-muted border border-border rounded-lg p-3">
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <OAuthButtons callbackUrl={callbackUrl} />

          <Divider />

          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <label htmlFor="email" className="text-sm text-muted-foreground">
                Sign in with email
              </label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We'll send you a magic link
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Sign in to Lunastak</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
