'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import Link from 'next/link'
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/16/solid'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@/components/ui/dropdown'
import { Avatar } from '@/components/ui/avatar'

interface SavedStrategy {
  id: string
  conversationId: string
  createdAt: string
  output: {
    vision?: string
    mission?: string
  }
}

export function AppLayout({
  children,
  experimentVariant = 'baseline-v1'
}: {
  children: React.ReactNode;
  experimentVariant?: string;
}) {
  return (
    <SidebarProvider>
      <AppSidebar experimentVariant={experimentVariant} />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <div className="flex flex-1 flex-col min-h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppSidebar({ experimentVariant = 'baseline-v1' }: { experimentVariant?: string }) {
  const { data: session } = useSession()
  const [strategies, setStrategies] = useState<SavedStrategy[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      fetchStrategies()
    }
  }, [session])

  // Listen for strategy saved events to refresh the list
  useEffect(() => {
    const handleStrategySaved = () => {
      if (session?.user?.id) {
        fetchStrategies()
      }
    }

    window.addEventListener('strategySaved', handleStrategySaved)
    return () => window.removeEventListener('strategySaved', handleStrategySaved)
  }, [session?.user?.id])

  const fetchStrategies = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/strategies')
      if (response.ok) {
        const data = await response.json()
        setStrategies(data.strategies)
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getUserInitials = () => {
    if (!session?.user?.name && !session?.user?.email) return 'G'
    const name = session.user.name || session.user.email || ''
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getUserDisplay = () => {
    if (!session) return 'Guest'
    return session.user?.name || session.user?.email?.split('@')[0] || 'User'
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-2">
          <img
            src="/lunastak-logo.svg"
            alt="Lunastak"
            className="h-8 w-auto"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {!session && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                <button
                  onClick={() => signIn('email', { callbackUrl: '/' })}
                  className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
                >
                  sign in
                </button>{' '}
                to see your recent work
              </div>
            )}
            {session && isLoading && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {session && !isLoading && strategies.length === 0 && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                No saved strategies yet
              </div>
            )}
            {session && !isLoading && strategies.length > 0 && (
              <SidebarMenu>
                {strategies.map((strategy) => (
                  <SidebarMenuItem key={strategy.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/strategy/${strategy.id}`}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium truncate">
                            {strategy.output.vision?.substring(0, 50) || 'Untitled Strategy'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(strategy.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {session ? (
              <Dropdown>
                <DropdownButton as="div" className="w-full">
                  <div className="flex items-center gap-3 px-2 py-2">
                    <Avatar initials={getUserInitials()} className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {getUserDisplay()}
                      </span>
                    </div>
                  </div>
                </DropdownButton>
                <DropdownMenu className="min-w-64" anchor="top start">
                  <DropdownItem onClick={() => signOut()}>
                    <ArrowRightStartOnRectangleIcon />
                    <DropdownLabel>Logout</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar initials="G" className="bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Guest</span>
                  <div className="text-xs flex gap-2">
                    <button
                      onClick={() => signIn('email', { callbackUrl: '/' })}
                      className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      sign in
                    </button>
                    <span className="text-muted-foreground">|</span>
                    <button
                      onClick={() => signIn('email', { callbackUrl: '/' })}
                      className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      create account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-2">
          <p className="text-xs text-muted-foreground">
            {experimentVariant}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
