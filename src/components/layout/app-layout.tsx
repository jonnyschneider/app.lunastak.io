'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  ChevronsUpDown,
  Sparkles,
  User,
  LogOut,
  FolderKanban,
  FolderPlus,
  Trash2,
  Pencil,
  Info,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
import {
  ProFeatureInterstitial,
  UpgradeSuccessDialog,
  ProComingSoonDialog,
  useProUpgradeFlow,
} from '@/components/ProUpgradeFlow'
import { PaywallModal } from '@/components/PaywallModal'
import { SignInGateDialog, SIGN_IN_GATE_PRESETS } from '@/components/SignInGateDialog'
import { useProjectActions } from '@/hooks/use-project-actions'
import { getStatsigClient } from '@/components/StatsigProvider'
import { usePaywall } from '@/hooks/use-paywall'
import { useHeaderSlot } from '@/components/HeaderContext'
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
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const { tabNav, rightSlot } = useHeaderSlot()

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [projectToRename, setProjectToRename] = useState<Project | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [signUpDialogOpen, setSignUpDialogOpen] = useState(false)

  const { isOpen: paywallOpen, modal: paywallModal, closePaywall } = usePaywall()
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

  const triggerProjectPaywall = async (): Promise<boolean> => {
    const response = await fetch('/api/paywall/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature: 'create_project' }),
    })
    if (!response.ok) return false
    const data = await response.json()
    if (data.blocked) {
      triggerUpgrade('unlimited-projects')
      return true
    }
    return false
  }

  const {
    createProject,
    deleteProject,
    isCreating: isCreatingProject,
    isDeleting,
  } = useProjectActions({ triggerPaywall: triggerProjectPaywall })

  // Derive selected project from pathname
  const pathnameProjectId = pathname?.match(/\/project\/([^\/]+)/)?.[1] || null
  const storedProjectId = typeof window !== 'undefined' ? localStorage.getItem('lastProjectId') : null
  const selectedProjectId = pathnameProjectId || (storedProjectId && projects.some(p => p.id === storedProjectId) ? storedProjectId : null) || projects[0]?.id || null
  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('lastProjectId', selectedProjectId)
    }
  }, [selectedProjectId])

  useEffect(() => {
    fetchProjects()
  }, [])

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
      const remaining = projects.filter(p => p.id !== projectToDelete.id)
      setProjects(remaining)
      setProjectToDelete(null)
      setProjectSwitcherOpen(false)
      window.dispatchEvent(new CustomEvent('projectDeleted', { detail: { projectId: projectToDelete.id } }))
      if (remaining.length === 0) {
        router.push('/')
      } else if (pathname?.includes(projectToDelete.id)) {
        router.push(`/project/${remaining[0].id}`)
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
        setProjects(projects.map(p => p.id === projectToRename.id ? { ...p, name: renameValue.trim() } : p))
        setProjectToRename(null)
        setRenameValue('')
      }
    } catch (error) {
      console.error('Failed to rename project:', error)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleCreateProject = async () => {
    getStatsigClient()?.logEvent('cta_create_project', 'header')
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
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase()
  }

  const getUserDisplay = () => {
    if (!session) return 'Guest'
    return session.user?.name || session.user?.email?.split('@')[0] || 'User'
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        {/* Desktop: single row */}
        <div className="flex h-14 items-center gap-6 px-6">
          {/* Logo */}
          <Link href={selectedProjectId ? `/project/${selectedProjectId}` : '/'} className="shrink-0 mr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lunastak-logo.svg" alt="Lunastak" className="h-9 w-auto" />
          </Link>

          {/* Tab navigation slot (injected by pages via HeaderContext) */}
          <div className="hidden md:flex items-center">
            {tabNav}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right slot (demo mode injects here) or default project switcher + account */}
          {rightSlot ? (
            <div className="flex items-center gap-3">
              {rightSlot}
            </div>
          ) : (
          <>
          {/* Project Switcher */}
          {!isLoadingProjects && projects.length > 0 && (
            <Popover open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-sm max-w-[200px]"
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selectedProject?.name || 'Select'}</span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0" align="end">
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
                            <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate text-sm">{project.name}</span>
                          </div>
                          <Check className={cn("h-3.5 w-3.5 shrink-0", selectedProject?.id === project.id ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={handleCreateProject} disabled={isCreatingProject} className="text-primary">
                        <FolderPlus className="h-3.5 w-3.5 shrink-0" />
                        <span>{isCreatingProject ? 'Creating...' : 'New Project'}</span>
                      </CommandItem>
                      {session && selectedProject && (
                        <CommandItem onSelect={() => {
                          setProjectToRename(selectedProject)
                          setRenameValue(selectedProject.name)
                          setProjectSwitcherOpen(false)
                        }}>
                          <Pencil className="h-3.5 w-3.5 shrink-0" />
                          <span>Rename</span>
                        </CommandItem>
                      )}
                      {session && selectedProject && (
                        <CommandItem onSelect={() => setProjectToDelete(selectedProject)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Delete</span>
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {/* Account */}
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <Avatar className="h-6 w-6 rounded-md bg-primary text-primary-foreground">
                    <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-[10px]">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline truncate text-sm max-w-[120px]">{getUserDisplay()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                {/* About section — branding + attribution */}
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">About</DropdownMenuLabel>
                <div className="px-2 py-2 space-y-2">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Built by{' '}
                    <a href="https://www.humventures.com.au" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Humble Ventures</a>.
                    {' '}<a href="https://thedecisionstack.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Decision Stack</a> by{' '}
                    <a href="https://martineriksson.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Martin Eriksson</a>.
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Data processed by Claude AI. Not used to train models.
                  </p>
                  <div className="flex gap-2">
                    <a href="https://www.humventures.com.au/privacy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline underline-offset-2">Privacy</a>
                    <a href="https://lunastak.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline underline-offset-2">Help</a>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/?signedOut=true' })}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 text-sm" asChild>
              <Link href="/auth/signin">
                <Avatar className="h-5 w-5 rounded-md bg-muted text-muted-foreground mr-1.5">
                  <AvatarFallback className="rounded-md bg-muted text-muted-foreground text-[10px]">G</AvatarFallback>
                </Avatar>
                Sign in
              </Link>
            </Button>
          )}
          </>
          )}
        </div>

        {/* Mobile: second row for tab nav */}
        <div className="md:hidden border-t">
          <div className="flex items-center px-4 py-1.5 overflow-x-auto">
            {tabNav}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* ---- Dialogs (layout-level) ---- */}

      {/* Rename Project Dialog */}
      <AlertDialog open={!!projectToRename} onOpenChange={(open) => {
        if (!open) { setProjectToRename(null); setRenameValue('') }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Project</AlertDialogTitle>
            <AlertDialogDescription>Enter a new name for this project.</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Project name"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && renameValue.trim()) handleRenameProject() }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenaming}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameProject} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming ? 'Saving...' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{projectToDelete?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign Up Gate */}
      <SignInGateDialog
        open={signUpDialogOpen}
        onOpenChange={setSignUpDialogOpen}
        title={SIGN_IN_GATE_PRESETS.addProject.title}
        description={SIGN_IN_GATE_PRESETS.addProject.description}
      />

      {/* Pro Upgrade Flow */}
      <ProFeatureInterstitial feature={currentFeature} open={interstitialOpen} onOpenChange={setInterstitialOpen} onUpgrade={handleUpgrade} />
      <UpgradeSuccessDialog open={successOpen} onOpenChange={setSuccessOpen} onContinue={handleContinue} />
      <ProComingSoonDialog feature={currentFeature} open={comingSoonOpen} onOpenChange={setComingSoonOpen} />

      {/* Paywall */}
      <PaywallModal open={paywallOpen} onOpenChange={(open) => !open && closePaywall()} modal={paywallModal} />
    </div>
  )
}
