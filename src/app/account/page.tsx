'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, User, Mail, Calendar, Shield, Sparkles } from 'lucide-react'

interface AccountInfo {
  email: string
  name: string | null
  createdAt: string
  isPro: boolean
  upgradedAt: string | null
  loginMethods: string[]
}

const providerLabels: Record<string, string> = {
  google: 'Google',
  email: 'Magic Link',
  github: 'GitHub',
}

export default function AccountPage() {
  const { status } = useSession()
  const router = useRouter()
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    fetch('/api/user/account')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error('Account fetch error:', data.error)
        } else {
          setAccount(data)
        }
        setIsLoading(false)
      })
      .catch(err => {
        console.error('Account fetch failed:', err)
        setIsLoading(false)
      })
  }, [status, router])

  if (status === 'loading' || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!account) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <p className="text-muted-foreground">Unable to load account information.</p>
        </div>
      </AppLayout>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="space-y-1 mb-8">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          </div>
          <p className="text-muted-foreground">
            Your account details and subscription status.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Profile</span>
              <Badge variant={account.isPro ? 'default' : 'secondary'}>
                {account.isPro ? (
                  <><Sparkles className="h-3 w-3 mr-1" /> Pro</>
                ) : (
                  'Free'
                )}
              </Badge>
            </CardTitle>
            <CardDescription>
              {account.isPro
                ? "You're on the Pro plan - thank you for being an early supporter!"
                : 'Upgrade to Pro to unlock premium features.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{account.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Login Method</p>
                <p className="text-sm text-muted-foreground">
                  {account.loginMethods
                    .map(m => providerLabels[m] || m)
                    .join(', ')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(account.createdAt)}
                </p>
              </div>
            </div>

            {account.isPro && account.upgradedAt && (
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Upgraded to Pro</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(account.upgradedAt)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
