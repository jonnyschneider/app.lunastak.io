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
  Plus,
  FolderKanban,
  Upload,
  MessageSquare,
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
import { Button } from '@/components/ui/button'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'

interface Project {
  id: string
  name: string
  fragmentCount: number
  conversationCount: number
  updatedAt: string
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
  const { data: session } = useSession()
  const [projectId, setProjectId] = useState<string | null>(null)

  // Fetch first project for logo link
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/projects')
        .then(res => res.json())
        .then(data => {
          if (data.projects && data.projects.length > 0) {
            setProjectId(data.projects[0].id)
          }
        })
        .catch(() => {})
    }
  }, [session])

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar experimentVariant={experimentVariant} showVariantBadge={showVariantBadge} />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Link href={projectId ? `/project/${projectId}` : '/'}>
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
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      fetchProjects()
    }
  }, [session])

  const fetchProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setIsLoadingProjects(false)
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

  // Get first project ID for links (temporary until multi-project)
  const firstProjectId = projects.length > 0 ? projects[0].id : null

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center justify-center border-b px-4">
        <Link
          href={firstProjectId ? `/project/${firstProjectId}` : '/'}
          className="flex items-center gap-2"
        >
          <img
            src="/lunastak-logo.svg"
            alt="Lunastak"
            className="h-8 w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* Quick Actions */}
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="flex gap-2 px-2 py-2">
              <Link
                href={firstProjectId ? `/?projectId=${firstProjectId}` : '/'}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span>New Chat</span>
              </Link>
              <button
                onClick={() => setUploadDialogOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects */}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            {!session && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                <Link
                  href="/auth/signin"
                  className="text-primary hover:text-primary/80 underline"
                >
                  Sign in
                </Link>{' '}
                to see your projects
              </div>
            )}
            {session && isLoadingProjects && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {session && !isLoadingProjects && projects.length === 0 && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                No projects yet
              </div>
            )}
            {session && !isLoadingProjects && projects.length > 0 && (
              <SidebarMenu>
                {projects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton asChild className="h-auto py-2">
                      <Link href={`/project/${project.id}`}>
                        <FolderKanban className="h-4 w-4" />
                        <div className="flex flex-col items-start gap-0.5 min-w-0">
                          <span className="font-medium text-sm leading-tight truncate">
                            {project.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {project.fragmentCount} fragments, {project.conversationCount} chats
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

        {/* Your Lunastak */}
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

      {/* Upload Dialog */}
      {firstProjectId && (
        <DocumentUploadDialog
          projectId={firstProjectId}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploadComplete={() => {
            // Could refresh project data here if needed
          }}
        />
      )}
    </Sidebar>
  )
}
