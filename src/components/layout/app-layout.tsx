'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronUp,
  ChevronRight,
  Check,
  ChevronsUpDown,
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
  FolderKanban,
  FolderPlus,
  Upload,
  MessageSquare,
  Trash2,
  RotateCcw,
  Atom,
  Glasses,
  TrendingUp,
  Lock,
  NotebookPen,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DocumentUploadDialog } from '@/components/document-upload-dialog'
import { FakeDoorDialog } from '@/components/FakeDoorDialog'
import { PaywallModal } from '@/components/PaywallModal'
import { SignInGateDialog, SIGN_IN_GATE_PRESETS } from '@/components/SignInGateDialog'
import { ChatSheet } from '@/components/chat-sheet'
import { useProjectActions } from '@/hooks/use-project-actions'
import { usePaywall } from '@/hooks/use-paywall'
import { useGenerationStatusContext } from '@/components/providers/GenerationStatusProvider'
import { GenerationStatusIndicator } from '@/components/GenerationStatusIndicator'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  fragmentCount: number
  conversationCount: number
  hasStrategy: boolean
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

  // Fetch first project for logo link (works for both auth and guests via cookie)
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (data.projects && data.projects.length > 0) {
          setProjectId(data.projects[0].id)
        }
      })
      .catch(() => {})
  }, [])

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
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null)
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false)
  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined)
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false)
  const [strategyHistory, setStrategyHistory] = useState<{id: string, createdAt: string}[] | null>(null)

  const { isOpen: paywallOpen, modal: paywallModal, triggerPaywall, closePaywall } = usePaywall()
  const { isGenerating } = useGenerationStatusContext()

  const {
    createProject,
    restoreDemo,
    deleteProject,
    isCreating: isCreatingProject,
    isRestoring: isRestoringDemo,
    isDeleting,
  } = useProjectActions({ triggerPaywall })

  // Derive selected project from pathname, fall back to first project
  const pathnameProjectId = pathname?.match(/\/project\/([^\/]+)/)?.[1] || null
  const selectedProjectId = pathnameProjectId || projects[0]?.id || null
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null

  // Fetch projects for both auth users and guests (API supports both via cookie)
  useEffect(() => {
    fetchProjects()
  }, [])

  // Fetch strategy history when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setStrategyHistory([])
      return
    }
    setStrategyHistory(null) // Reset to loading state
    fetch(`/api/project/${selectedProjectId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.strategyOutputs) {
          setStrategyHistory(data.strategyOutputs)
        } else {
          setStrategyHistory([])
        }
      })
      .catch(() => setStrategyHistory([]))
  }, [selectedProjectId])

  // Refresh strategy history when generation completes
  useEffect(() => {
    const handleGenerationComplete = (event: CustomEvent<{ projectId: string }>) => {
      if (event.detail.projectId === selectedProjectId) {
        // Refresh strategy history
        fetch(`/api/project/${selectedProjectId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.strategyOutputs) {
              setStrategyHistory(data.strategyOutputs)
            }
          })
          .catch(() => {})
      }
    }

    window.addEventListener('generationComplete', handleGenerationComplete as EventListener)
    return () => {
      window.removeEventListener('generationComplete', handleGenerationComplete as EventListener)
    }
  }, [selectedProjectId])

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

    const success = await deleteProject(projectToDelete.id)
    if (success) {
      const remainingProjects = projects.filter(p => p.id !== projectToDelete.id)
      setProjects(remainingProjects)
      setProjectToDelete(null)
      setProjectSwitcherOpen(false)

      // Notify listeners that a project was deleted
      window.dispatchEvent(new CustomEvent('projectDeleted', {
        detail: { projectId: projectToDelete.id }
      }))

      // Check if we're currently viewing the deleted project
      const isViewingDeletedProject = pathname?.includes(projectToDelete.id)

      if (remainingProjects.length === 0) {
        router.push('/')
      } else if (isViewingDeletedProject) {
        router.push(`/project/${remainingProjects[0].id}`)
      }
    }
  }

  const handleRestoreDemo = async () => {
    const projectId = await restoreDemo()
    if (projectId) {
      await fetchProjects()
      setProjectSwitcherOpen(false)
      router.push(`/project/${projectId}`)
    }
  }

  const handleCreateProject = async () => {
    // Guests must sign in to create projects
    if (!session) {
      setProjectSwitcherOpen(false)
      setSignUpDialogOpen(true)
      return
    }

    const projectId = await createProject()
    if (projectId) {
      await fetchProjects()
      setProjectSwitcherOpen(false)
      router.push(`/project/${projectId}`)
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
      <SidebarHeader className="border-b px-3 py-3">
        {/* Project Switcher - shown for both auth and guest users */}
        {isLoadingProjects ? (
          <div className="h-9 flex items-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No projects yet
          </div>
        ) : (
          <Popover open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={projectSwitcherOpen}
                className="w-full justify-between h-auto py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <div className="flex flex-col items-start gap-0 min-w-0 text-left">
                    <span className="font-medium text-sm leading-tight truncate">
                      {selectedProject?.name || 'Select project'}
                    </span>
                    {selectedProject && (
                      <span className="text-xs text-muted-foreground">
                        {selectedProject.fragmentCount} fragments
                      </span>
                    )}
                  </div>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search projects..." />
                <CommandList>
                  <CommandEmpty>No project found.</CommandEmpty>
                  <CommandGroup>
                    {projects.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={project.name}
                        onSelect={() => {
                          router.push(`/project/${project.id}`)
                          setProjectSwitcherOpen(false)
                        }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderKanban className="h-4 w-4 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{project.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {project.fragmentCount} fragments
                            </span>
                          </div>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            selectedProject?.id === project.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={handleCreateProject}
                      disabled={isCreatingProject}
                      className="text-primary"
                    >
                      <FolderPlus className="h-4 w-4 shrink-0" />
                      <span>{isCreatingProject ? 'Creating...' : 'Add Project'}</span>
                    </CommandItem>
                    {session && (
                      <CommandItem
                        onSelect={handleRestoreDemo}
                        disabled={isRestoringDemo}
                      >
                        <RotateCcw className={`h-4 w-4 shrink-0 ${isRestoringDemo ? 'animate-spin' : ''}`} />
                        <span>{isRestoringDemo ? 'Restoring...' : 'Restore Demo'}</span>
                      </CommandItem>
                    )}
                    {session && selectedProject && (
                      <CommandItem
                        onSelect={() => setProjectToDelete(selectedProject)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span>Delete Current Project</span>
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </SidebarHeader>
      <SidebarContent>
        {/* Quick Actions - show when project selected (both auth and guests) */}
        {selectedProject && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setChatSheetOpen(true)}>
                    <MessageSquare className="h-4 w-4" />
                    <span>New Chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      setUploadProjectId(selectedProject.id)
                      setUploadDialogOpen(true)
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Document</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setFakeDoorOpen(true)}>
                    <NotebookPen className="h-4 w-4" />
                    <span>Add Memo</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Project Navigation - show when project selected (both auth and guests) */}
        {selectedProject && (
          <SidebarGroup>
            <SidebarGroupLabel>Focus</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === `/project/${selectedProject.id}` || pathname === `/project/${selectedProject.id}/thinking`}>
                    <Link href={`/project/${selectedProject.id}`}>
                      <Glasses className="h-4 w-4" />
                      <span>Your Thinking</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <Collapsible asChild defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <Atom className="h-4 w-4" />
                        <span>Your Strategy</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {/* Show generating indicator when active */}
                        {isGenerating(selectedProject.id) && (
                          <SidebarMenuSubItem>
                            <div className="px-2 py-1.5">
                              <GenerationStatusIndicator
                                status="generating"
                                size="sm"
                                generatingLabel="generating..."
                              />
                            </div>
                          </SidebarMenuSubItem>
                        )}
                        {strategyHistory === null ? (
                          <SidebarMenuSubItem>
                            <span className="text-xs text-muted-foreground px-2 py-1">Loading...</span>
                          </SidebarMenuSubItem>
                        ) : strategyHistory.length === 0 && !isGenerating(selectedProject.id) ? (
                          <SidebarMenuSubItem>
                            <span className="text-xs text-muted-foreground px-2 py-1">No strategies yet</span>
                          </SidebarMenuSubItem>
                        ) : (
                          strategyHistory.map((s) => (
                            <SidebarMenuSubItem key={s.id}>
                              <SidebarMenuSubButton asChild isActive={pathname === `/strategy/${s.id}`}>
                                <Link href={`/strategy/${s.id}`}>
                                  {new Date(s.createdAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === `/project/${selectedProject.id}/outcomes`}>
                    <Link href={`/project/${selectedProject.id}/outcomes`}>
                      <TrendingUp className="h-4 w-4" />
                      <span>Manage Outcomes</span>
                      <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
        {/* Beta Preview label */}
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/50">
          <span className="text-muted-foreground/70">Beta Preview</span>
          <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/50">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
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
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/?signedOut=true' })}>
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
          onUploadComplete={(fileName) => {
            // Check if this was an empty project (first document = first-time experience)
            if (selectedProject &&
                selectedProject.fragmentCount === 0 &&
                selectedProject.conversationCount === 0 &&
                fileName) {
              // Launch chat sheet with context about the uploaded doc
              setChatInitialQuestion(`I've uploaded ${fileName}. Let's discuss it.`)
              setChatSheetOpen(true)
            }
            fetchProjects()
          }}
        />
      )}

      {/* Chat Sheet */}
      {selectedProject && (
        <ChatSheet
          projectId={selectedProject.id}
          open={chatSheetOpen}
          onOpenChange={(open) => {
            setChatSheetOpen(open)
            if (!open) setChatInitialQuestion(undefined)
          }}
          initialQuestion={chatInitialQuestion}
          hasExistingStrategy={selectedProject.hasStrategy}
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

      {/* Sign Up Required Dialog (for guests adding projects) */}
      <SignInGateDialog
        open={signUpDialogOpen}
        onOpenChange={setSignUpDialogOpen}
        title={SIGN_IN_GATE_PRESETS.addProject.title}
        description={SIGN_IN_GATE_PRESETS.addProject.description}
      />

      {/* Memo Fake Door Dialog */}
      <FakeDoorDialog
        open={fakeDoorOpen}
        onOpenChange={setFakeDoorOpen}
        featureName="Memos"
        description="Capture quick thoughts, voice notes, or observations directly in your project.

Jot down ideas from meetings, record voice memos on the go, or capture spontaneous insights. Luna will extract strategic themes from your memos."
        onInterest={() => {
          // Log interest for now
          console.log(`[FakeDoor] User interested in: Add Memo (sidebar)`)
        }}
      />

      {/* Paywall Modal */}
      <PaywallModal
        open={paywallOpen}
        onOpenChange={(open) => !open && closePaywall()}
        modal={paywallModal}
      />
    </Sidebar>
  )
}
