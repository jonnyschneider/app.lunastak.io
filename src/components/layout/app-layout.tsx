'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronUp,
  Check,
  ChevronsUpDown,
  Sparkles,
  User,
  LogOut,
  FolderKanban,
  FolderPlus,
  Upload,
  MessageSquare,
  Trash2,
  RotateCcw,
  Pencil,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
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
import {
  ProFeatureInterstitial,
  UpgradeSuccessDialog,
  ProComingSoonDialog,
  useProUpgradeFlow,
} from '@/components/ProUpgradeFlow'
import { PaywallModal } from '@/components/PaywallModal'
import { SignInGateDialog, SIGN_IN_GATE_PRESETS } from '@/components/SignInGateDialog'
import { ChatSheet } from '@/components/chat-sheet'
import { useProjectActions } from '@/hooks/use-project-actions'
import { getStatsigClient } from '@/components/StatsigProvider'
import { usePaywall } from '@/hooks/use-paywall'
import { useDocumentProcessingContext } from '@/components/providers/DocumentProcessingProvider'
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
    <SidebarProvider defaultOpen={false}>
      <AppSidebar experimentVariant={experimentVariant} showVariantBadge={showVariantBadge} />
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 bg-sidebar">
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
  const [projectToRename, setProjectToRename] = useState<Project | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null)
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [chatSheetOpen, setChatSheetOpen] = useState(false)
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined)
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false)

  const { isOpen: paywallOpen, modal: paywallModal, triggerPaywall, closePaywall } = usePaywall()
  const { isProcessing: isProcessingDocuments, processingCount } = useDocumentProcessingContext()
  const {
    isPro,
    interstitialOpen,
    setInterstitialOpen,
    successOpen,
    setSuccessOpen,
    comingSoonOpen,
    setComingSoonOpen,
    currentFeature,
    triggerUpgrade,
    handleUpgrade,
    handleContinue,
  } = useProUpgradeFlow()

  // Custom paywall trigger that uses ProUpgradeFlow instead of external pricing link
  const triggerProjectPaywall = async (): Promise<boolean> => {
    // Check if user would be blocked
    const response = await fetch('/api/paywall/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature: 'create_project' }),
    })

    if (!response.ok) return false // Allow on error

    const data = await response.json()
    if (data.blocked) {
      // Show ProUpgradeFlow instead of PaywallModal
      triggerUpgrade('unlimited-projects')
      return true
    }
    return false
  }

  const {
    createProject,
    restoreDemo,
    deleteProject,
    isCreating: isCreatingProject,
    isRestoring: isRestoringDemo,
    isDeleting,
  } = useProjectActions({ triggerPaywall: triggerProjectPaywall })

  // Derive selected project from pathname, fall back to localStorage, then first project
  const pathnameProjectId = pathname?.match(/\/project\/([^\/]+)/)?.[1] || null
  const storedProjectId = typeof window !== 'undefined' ? localStorage.getItem('lastProjectId') : null
  const selectedProjectId = pathnameProjectId || (storedProjectId && projects.some(p => p.id === storedProjectId) ? storedProjectId : null) || projects[0]?.id || null
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null

  // Persist last-viewed project to localStorage
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('lastProjectId', selectedProjectId)
    }
  }, [selectedProjectId])

  // Fetch projects for both auth users and guests (API supports both via cookie)
  useEffect(() => {
    fetchProjects()
  }, [])

  // Listen for generation events (for toast/refresh purposes)
  useEffect(() => {
    const handleGenerationComplete = (event: CustomEvent<{ projectId: string }>) => {
      // Could trigger sidebar notifications in future
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

  const handleRenameProject = async () => {
    if (!projectToRename || !renameValue.trim()) return

    setIsRenaming(true)
    try {
      const res = await fetch(`/api/projects/${projectToRename.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })

      if (res.ok) {
        setProjects(projects.map(p =>
          p.id === projectToRename.id ? { ...p, name: renameValue.trim() } : p
        ))
        setProjectToRename(null)
        setRenameValue('')
      }
    } catch (error) {
      console.error('Failed to rename project:', error)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleRestoreDemo = async () => {
    getStatsigClient()?.logEvent('cta_restore_demo', 'sidebar')
    const result = await restoreDemo()
    if (result) {
      await fetchProjects()
      setProjectSwitcherOpen(false)
      // Navigate to strategy view so users see the output, not just inputs
      if (result.latestTraceId) {
        router.push(`/strategy/${result.latestTraceId}`)
      } else {
        router.push(`/project/${result.projectId}/strategy`)
      }
    }
  }

  const handleCreateProject = async () => {
    getStatsigClient()?.logEvent('cta_create_project', 'sidebar')
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
      <SidebarHeader className="h-16 border-b px-3 !flex-row items-center">
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
                className="w-full justify-between h-9 data-[state=open]:bg-muted data-[state=open]:text-foreground"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {selectedProject?.name || 'Select project'}
                  </span>
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
                    {session && selectedProject && (
                      <CommandItem
                        onSelect={() => {
                          setProjectToRename(selectedProject)
                          setRenameValue(selectedProject.name)
                          setProjectSwitcherOpen(false)
                        }}
                      >
                        <Pencil className="h-4 w-4 shrink-0" />
                        <span>Rename Project</span>
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
        {/* Spacer pushes helper links to bottom of content area */}
        <div className="flex-1" />
        <div className="px-3 py-4 space-y-8 text-center">
          {/* Lunastak */}
          <div className="flex flex-col items-center space-y-1.5">
            <img src="/lunastak-logo-teal.svg" alt="Lunastak" className="h-12" />
            <p className="text-xs text-muted-foreground/90">Your second brain for strategic clarity.</p>
            <div className="text-xs text-muted-foreground/90 space-y-0.5">
              <p>Built by <a href="https://www.humventures.com.au" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Jonny Schneider</a> at <a href="https://www.humventures.com.au" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Humble Ventures</a></p>
              <p>© {new Date().getFullYear()} Humble Ventures Pty Ltd</p>
            </div>
          </div>

          {/* Decision Stack */}
          <div className="flex flex-col items-center gap-1.5">
            <a href="https://thedecisionstack.com" target="_blank" rel="noopener noreferrer" className="block">
              <img src="/Decision Stack Logo.svg" alt="The Decision Stack" className="h-8" />
            </a>
            <p className="text-xs text-muted-foreground/90">
              <a href="https://thedecisionstack.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">The Decision Stack</a> by <a href="https://martineriksson.com" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Martin Eriksson</a>. Used with permission.
            </p>
          </div>

          {/* Data statement + links */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground/90 leading-relaxed text-left">
              Your data is processed by Anthropic&apos;s Claude AI and is not used to train AI models. Uploaded documents are not stored — only the strategic insights extracted from them. Conversations and generated artefacts are retained to build your Decision Stack.
            </p>
            <div className="flex items-center justify-center gap-2">
              <a href="https://www.humventures.com.au/privacy" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/90 h-8">Privacy Notice</Button>
              </a>
              <a href="https://lunastak.io" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/90 h-8">Help</Button>
              </a>
            </div>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="default"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-6 w-6 rounded-md bg-primary text-primary-foreground">
                      <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">
                      {getUserDisplay()}
                    </span>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  {!isPro && (
                    <>
                      <DropdownMenuItem onSelect={() => triggerUpgrade('model-selection')}>
                        <Sparkles className="h-4 w-4" />
                        Upgrade to Pro
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <User className="h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/?signedOut=true' })}>
                    <LogOut className="h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="default" asChild>
                <Link href="/auth/signin">
                  <Avatar className="h-6 w-6 rounded-md bg-muted text-muted-foreground">
                    <AvatarFallback className="rounded-md bg-muted text-muted-foreground text-xs">G</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">Guest</span>
                  <span className="truncate text-xs text-primary">
                    Sign in
                  </span>
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

      {/* Rename Project Dialog */}
      <AlertDialog open={!!projectToRename} onOpenChange={(open) => {
        if (!open) {
          setProjectToRename(null)
          setRenameValue('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Project</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Project name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                handleRenameProject()
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenaming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRenameProject}
              disabled={isRenaming || !renameValue.trim()}
            >
              {isRenaming ? 'Saving...' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Pro Upgrade Flow Dialogs */}
      <ProFeatureInterstitial
        feature={currentFeature}
        open={interstitialOpen}
        onOpenChange={setInterstitialOpen}
        onUpgrade={handleUpgrade}
      />
      <UpgradeSuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        onContinue={handleContinue}
      />
      <ProComingSoonDialog
        feature={currentFeature}
        open={comingSoonOpen}
        onOpenChange={setComingSoonOpen}
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
