'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
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
  MoreHorizontal,
  Trash2,
  RotateCcw,
  Target,
  Brain,
  TrendingUp,
  Lock,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
    <SidebarProvider defaultOpen={true}>
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
  const router = useRouter()
  const pathname = usePathname()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRestoringDemo, setIsRestoringDemo] = useState(false)
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null)

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

  const handleDeleteProject = async () => {
    if (!projectToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        const remainingProjects = projects.filter(p => p.id !== projectToDelete.id)
        setProjects(remainingProjects)
        setProjectToDelete(null)

        // Notify listeners that a project was deleted (pattern from SessionTransferProvider)
        // TODO: Replace with proper state management when designing app-wide state
        window.dispatchEvent(new CustomEvent('projectDeleted', {
          detail: { projectId: projectToDelete.id }
        }))

        // Check if we're currently viewing the deleted project or its content
        const isViewingDeletedProject = pathname?.includes(projectToDelete.id)

        if (remainingProjects.length === 0) {
          // No projects left - go to homepage (shows empty state)
          router.push('/')
        } else if (isViewingDeletedProject) {
          // Was viewing deleted project - go to first remaining
          router.push(`/project/${remainingProjects[0].id}`)
        }
        // Otherwise stay on current page
      } else {
        console.error('Failed to delete project')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRestoreDemo = async () => {
    setIsRestoringDemo(true)
    try {
      const response = await fetch('/api/projects/restore-demo', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        // Refresh projects list and navigate to demo
        await fetchProjects()
        router.push(`/project/${data.projectId}`)
      } else {
        console.error('Failed to restore demo project')
      }
    } catch (error) {
      console.error('Failed to restore demo:', error)
    } finally {
      setIsRestoringDemo(false)
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction>
                          <MoreHorizontal className="h-4 w-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() => setProjectToDelete(project)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                      {session && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <button
                              onClick={handleRestoreDemo}
                              disabled={isRestoringDemo}
                              className="w-full"
                            >
                              <RotateCcw className={`h-4 w-4 ${isRestoringDemo ? 'animate-spin' : ''}`} />
                              <span>{isRestoringDemo ? 'Restoring...' : 'Restore Demo Project'}</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
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
      {uploadProjectId && (
        <DocumentUploadDialog
          projectId={uploadProjectId}
          open={uploadDialogOpen}
          onOpenChange={(open) => {
            setUploadDialogOpen(open)
            if (!open) setUploadProjectId(null)
          }}
          onUploadComplete={() => {
            fetchProjects()
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This will permanently delete all conversations, fragments, and generated content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
