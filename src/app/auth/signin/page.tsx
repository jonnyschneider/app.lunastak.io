'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-muted border border-border rounded-lg p-3">
                <p className="text-sm text-foreground">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send magic link'}
            </Button>
          </CardFooter>
        </form>
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
