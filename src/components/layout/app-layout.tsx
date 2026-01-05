'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import {
  ChevronUp,
  ChevronRight,
  Settings,
  BookOpen,
  Puzzle,
  Cpu,
  SlidersHorizontal,
  Rocket,
  HelpCircle,
  LifeBuoy,
  Sparkles,
  User,
  CreditCard,
  Bell,
  LogOut,
  MoreHorizontal,
  Star,
  Trash2,
  Plus,
} from 'lucide-react'
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
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface SavedStrategy {
  id: string
  conversationId: string
  createdAt: string
  output: {
    vision?: string
    strategy?: string
  }
  starred: boolean
  starredAt: string | null
}

export function AppLayout({
  children,
  experimentVariant,
  showVariantBadge = false
}: {
  children: React.ReactNode;
  experimentVariant?: string;
  showVariantBadge?: boolean;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar experimentVariant={experimentVariant} showVariantBadge={showVariantBadge} />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Link href="/">
            <img
              src="/lunastak-logo.svg"
              alt="Lunastak"
              className="h-12 w-auto"
            />
          </Link>
        </header>
        <div className="flex flex-1 flex-col min-h-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppSidebar({ experimentVariant, showVariantBadge = false }: { experimentVariant?: string; showVariantBadge?: boolean }) {
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

  const toggleStar = async (strategyId: string, currentStarred: boolean) => {
    // Optimistic update
    setStrategies(prev =>
      prev.map(s =>
        s.id === strategyId
          ? { ...s, starred: !currentStarred, starredAt: !currentStarred ? new Date().toISOString() : null }
          : s
      )
    )

    try {
      const response = await fetch(`/api/strategies/${strategyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !currentStarred }),
      })

      if (!response.ok) {
        // Revert on failure
        setStrategies(prev =>
          prev.map(s =>
            s.id === strategyId
              ? { ...s, starred: currentStarred, starredAt: s.starredAt }
              : s
          )
        )
      }
    } catch (error) {
      console.error('Failed to toggle star:', error)
      // Revert on failure
      setStrategies(prev =>
        prev.map(s =>
          s.id === strategyId
            ? { ...s, starred: currentStarred, starredAt: s.starredAt }
            : s
        )
      )
    }
  }

  // Separate starred and unstarred strategies
  const starredStrategies = strategies.filter(s => s.starred)
  const unstarredStrategies = strategies.filter(s => !s.starred)

  const renderStrategyItem = (strategy: SavedStrategy) => (
    <SidebarMenuItem key={strategy.id}>
      <SidebarMenuButton asChild className="h-auto py-2 pr-8">
        <Link href={`/strategy/${strategy.id}`}>
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="font-medium text-sm leading-tight line-clamp-2">
              {strategy.output.vision || 'Untitled Strategy'}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(strategy.createdAt).toLocaleDateString()}
            </span>
          </div>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={() => toggleStar(strategy.id, strategy.starred)}>
            <Star className={`h-4 w-4 ${strategy.starred ? 'fill-current' : ''}`} />
            {strategy.starred ? 'Unstar' : 'Star'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center justify-center border-b px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New conversation</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* Group 1: Conversations */}
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            {!session && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                <Link
                  href="/auth/signin"
                  className="text-primary hover:text-primary/80 underline"
                >
                  Sign in
                </Link>{' '}
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
              <>
                {/* Starred section - only show if there are starred items */}
                {starredStrategies.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 mt-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Star className="h-3 w-3 fill-current" />
                      Starred
                    </div>
                    <SidebarMenu>
                      {starredStrategies.map(renderStrategyItem)}
                    </SidebarMenu>
                    {unstarredStrategies.length > 0 && (
                      <div className="px-2 py-1.5 mt-2 text-xs font-medium text-muted-foreground">
                        Recent
                      </div>
                    )}
                  </>
                )}
                {/* Unstarred/Recent section */}
                {unstarredStrategies.length > 0 && (
                  <SidebarMenu>
                    {unstarredStrategies.map(renderStrategyItem)}
                  </SidebarMenu>
                )}
              </>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Group 2: Your Lunastak */}
        <SidebarGroup>
          <SidebarGroupLabel>Your Lunastak</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Settings with collapsible sub-menu */}
              <Collapsible asChild className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href="#">
                            <Puzzle className="h-4 w-4" />
                            <span>Integrations</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href="#">
                            <Cpu className="h-4 w-4" />
                            <span>Models</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href="#">
                            <SlidersHorizontal className="h-4 w-4" />
                            <span>Preferences</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Documentation with collapsible sub-menu */}
              <Collapsible asChild className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <BookOpen className="h-4 w-4" />
                      <span>Documentation</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href="#">
                            <Rocket className="h-4 w-4" />
                            <span>Getting started</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href="#">
                            <HelpCircle className="h-4 w-4" />
                            <span>FAQ</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <a href="#">
                            <LifeBuoy className="h-4 w-4" />
                            <span>Help</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Version and variant indicator for testing/debugging - only shown during active conversation */}
        {showVariantBadge && experimentVariant && (
          <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground/50 truncate border-t border-border/50">
            v{process.env.NEXT_PUBLIC_APP_VERSION} · {experimentVariant}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg bg-primary text-primary-foreground">
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {getUserDisplay()}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {session.user?.email}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem>
                    <Sparkles className="h-4 w-4" />
                    Upgrade to Pro
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="h-4 w-4" />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell className="h-4 w-4" />
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" asChild>
                <Link href="/auth/signin">
                  <Avatar className="h-8 w-8 rounded-lg bg-muted text-muted-foreground">
                    <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">G</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Guest</span>
                    <span className="truncate text-xs text-primary">
                      Sign in to save your work
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
