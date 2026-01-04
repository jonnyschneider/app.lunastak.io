'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
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
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <img
            src="/lunastak-logo.svg"
            alt="Lunastak"
            className="h-12 w-auto"
          />
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
      <SidebarContent>
        {/* Group 1: Conversations */}
        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            {!session && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                <button
                  onClick={() => signIn('email', { callbackUrl: '/' })}
                  className="text-primary hover:text-primary/80 underline"
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
              <SidebarMenuButton
                size="lg"
                onClick={() => signIn('email', { callbackUrl: '/' })}
              >
                <Avatar className="h-8 w-8 rounded-lg bg-muted text-muted-foreground">
                  <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">G</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Guest</span>
                  <span className="truncate text-xs text-primary">
                    Sign in to save your work
                  </span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
