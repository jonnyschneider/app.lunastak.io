# Project Navigation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure sidebar navigation to reflect Strategy/Thinking/Outcomes model, remove ambiguous top-level actions.

**Architecture:** Replace flat project list with collapsible project items containing submenu. Current project view becomes "Thinking" view. New "Strategy" view shows locked artifact. "Outcomes" is fake door.

**Tech Stack:** Next.js App Router, shadcn/ui sidebar components, Lucide icons

---

## Task 1: Add Icons Import for New Navigation

**Files:**
- Modify: `src/components/layout/app-layout.tsx:7-30`

**Step 1: Add new icon imports**

Add `Target`, `Brain`, `TrendingUp`, `Lock` to the lucide-react imports:

```typescript
import {
  ChevronUp,
  ChevronRight,
  ChevronDown,
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
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "chore: add icons for project navigation restructure"
```

---

## Task 2: Remove Quick Actions Section from Sidebar

**Files:**
- Modify: `src/components/layout/app-layout.tsx:257-278`

**Step 1: Delete the Quick Actions SidebarGroup**

Remove this entire block (lines 258-278):

```typescript
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
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "refactor: remove top-level Quick Actions from sidebar"
```

---

## Task 3: Add State for Upload Dialog Project Context

**Files:**
- Modify: `src/components/layout/app-layout.tsx:138-141`

**Step 1: Add state for tracking which project to upload to**

After `const [isRestoringDemo, setIsRestoringDemo] = useState(false)`, add:

```typescript
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null)
```

**Step 2: Update DocumentUploadDialog to use uploadProjectId**

Find the DocumentUploadDialog near the bottom (around line 531-541) and change:

From:
```typescript
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
```

To:
```typescript
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
```

**Step 3: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "refactor: add project context for upload dialog"
```

---

## Task 4: Expand Project Context Menu with New Chat and Upload

**Files:**
- Modify: `src/components/layout/app-layout.tsx:322-337`

**Step 1: Add New Chat and Upload to project dropdown**

Replace the DropdownMenuContent block:

From:
```typescript
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() => setProjectToDelete(project)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
```

To:
```typescript
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem asChild>
                          <Link href={`/?projectId=${project.id}`}>
                            <MessageSquare className="h-4 w-4" />
                            New Chat
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setUploadProjectId(project.id)
                            setUploadDialogOpen(true)
                          }}
                        >
                          <Upload className="h-4 w-4" />
                          Upload Document
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setProjectToDelete(project)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Test manually**

Run: `npm run dev`
- Open sidebar
- Click "..." on a project
- Verify "New Chat", "Upload Document", and "Delete Project" appear
- Verify New Chat links to `/?projectId=...`
- Verify Upload opens dialog

**Step 4: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "feat: add New Chat and Upload to project context menu"
```

---

## Task 5: Replace Flat Project List with Collapsible Submenu

**Files:**
- Modify: `src/components/layout/app-layout.tsx:305-341`

**Step 1: Replace project list rendering with collapsible structure**

Replace the entire `{session && !isLoadingProjects && projects.length > 0 && (` block:

From:
```typescript
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
                      ... existing dropdown ...
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
```

To:
```typescript
            {session && !isLoadingProjects && projects.length > 0 && (
              <SidebarMenu>
                {projects.map((project) => (
                  <Collapsible key={project.id} asChild defaultOpen={pathname?.includes(project.id)} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="h-auto py-2">
                          <FolderKanban className="h-4 w-4" />
                          <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                            <span className="font-medium text-sm leading-tight truncate">
                              {project.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {project.fragmentCount} fragments
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction>
                            <MoreHorizontal className="h-4 w-4" />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem asChild>
                            <Link href={`/?projectId=${project.id}`}>
                              <MessageSquare className="h-4 w-4" />
                              New Chat
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setUploadProjectId(project.id)
                              setUploadDialogOpen(true)
                            }}
                          >
                            <Upload className="h-4 w-4" />
                            Upload Document
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setProjectToDelete(project)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === `/project/${project.id}/strategy`}>
                              <Link href={`/project/${project.id}/strategy`}>
                                <Target className="h-4 w-4" />
                                <span>Strategy</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === `/project/${project.id}` || pathname === `/project/${project.id}/thinking`}>
                              <Link href={`/project/${project.id}`}>
                                <Brain className="h-4 w-4" />
                                <span>Thinking</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname === `/project/${project.id}/outcomes`}>
                              <Link href={`/project/${project.id}/outcomes`}>
                                <TrendingUp className="h-4 w-4" />
                                <span>Outcomes</span>
                                <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            )}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Test manually**

Run: `npm run dev`
- Projects should now be collapsible
- Each project shows Strategy / Thinking / Outcomes submenu
- Outcomes shows lock icon
- Current page should be highlighted

**Step 4: Commit**

```bash
git add src/components/layout/app-layout.tsx
git commit -m "feat: add collapsible project submenu with Strategy/Thinking/Outcomes"
```

---

## Task 6: Create Strategy View Route

**Files:**
- Create: `src/app/project/[id]/strategy/page.tsx`

**Step 1: Create the strategy page**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Target,
  Loader2,
  ArrowRight,
  Brain,
  RefreshCw,
} from 'lucide-react'

interface StrategyOutput {
  id: string
  createdAt: string
  vision: string | null
  strategy: string | null
  objectives: Array<{
    id: string
    title: string
    description: string
    timeframe: string | null
    direction: string | null
    targetMetric: string | null
  }>
}

interface ProjectStrategy {
  id: string
  name: string
  latestStrategy: StrategyOutput | null
  hasNewThinking: boolean
  thinkingCount: number
}

export default function StrategyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [data, setData] = useState<ProjectStrategy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchStrategy()
  }, [session, status, router, projectId])

  const fetchStrategy = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/project/${projectId}/strategy`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found')
        }
        throw new Error('Failed to fetch strategy')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Error fetching strategy:', err)
      setError(err instanceof Error ? err.message : 'Failed to load strategy')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchStrategy} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const strategy = data?.latestStrategy

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {data?.name || 'Strategy'}
            </h1>
            <p className="text-muted-foreground">
              Your current strategic direction
            </p>
          </div>
          {data?.hasNewThinking && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <RefreshCw className="h-3 w-3 mr-1" />
              New thinking available
            </Badge>
          )}
        </div>

        {strategy ? (
          <div className="space-y-6">
            {/* Vision */}
            {strategy.vision && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg leading-relaxed">{strategy.vision}</p>
                </CardContent>
              </Card>
            )}

            {/* Strategy */}
            {strategy.strategy && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed whitespace-pre-wrap">{strategy.strategy}</p>
                </CardContent>
              </Card>
            )}

            {/* Objectives */}
            {strategy.objectives && strategy.objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Objectives</CardTitle>
                  <CardDescription>
                    {strategy.objectives.length} objective{strategy.objectives.length !== 1 ? 's' : ''} defined
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {strategy.objectives.map((obj, index) => (
                    <div key={obj.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {index + 1}.
                        </span>
                        <h4 className="font-medium">{obj.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{obj.description}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {obj.timeframe && <span>Timeframe: {obj.timeframe}</span>}
                        {obj.targetMetric && <span>Target: {obj.targetMetric}</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <div className="text-sm text-muted-foreground">
              Last generated: {new Date(strategy.createdAt).toLocaleDateString()}
              {' · '}
              <Link href={`/strategy/${strategy.id}`} className="text-primary hover:underline">
                View full details
              </Link>
            </div>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No strategy generated yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                Have conversations and add context in your Thinking space, then generate your strategy.
              </p>
              <Button asChild>
                <Link href={`/project/${projectId}`}>
                  <Brain className="h-4 w-4 mr-2" />
                  Go to Thinking
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors (API endpoint doesn't exist yet but page compiles)

**Step 3: Commit**

```bash
git add src/app/project/[id]/strategy/page.tsx
git commit -m "feat: add Strategy view page"
```

---

## Task 7: Create Strategy API Endpoint

**Files:**
- Create: `src/app/api/project/[id]/strategy/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projectId = params.id

  try {
    // Fetch project with latest strategy output
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        generatedOutputs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            vision: true,
            strategy: true,
            objectives: {
              select: {
                id: true,
                title: true,
                description: true,
                timeframe: true,
                direction: true,
                targetMetric: true,
              },
            },
          },
        },
        fragments: {
          select: { id: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const latestStrategy = project.generatedOutputs[0] || null

    // Check if there's new thinking since last strategy
    const hasNewThinking = latestStrategy
      ? project.updatedAt > latestStrategy.createdAt
      : project.fragments.length > 0

    return NextResponse.json({
      id: project.id,
      name: project.name,
      latestStrategy,
      hasNewThinking,
      thinkingCount: project.fragments.length,
    })
  } catch (error) {
    console.error('Error fetching project strategy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch strategy' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/project/[id]/strategy/route.ts
git commit -m "feat: add Strategy API endpoint"
```

---

## Task 8: Create Outcomes Fake Door Page

**Files:**
- Create: `src/app/project/[id]/outcomes/page.tsx`

**Step 1: Create the outcomes page**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Loader2,
  Bell,
  BarChart3,
  CalendarCheck,
  FileText,
} from 'lucide-react'

export default function OutcomesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const [projectName, setProjectName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [notifyRequested, setNotifyRequested] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Fetch project name
    fetch(`/api/project/${projectId}`)
      .then(res => res.json())
      .then(data => {
        setProjectName(data.name)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [session, status, router, projectId])

  const handleNotify = () => {
    // In future, this would call an API to register interest
    setNotifyRequested(true)
  }

  if (status === 'loading' || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {projectName || 'Outcomes'}
          </h1>
          <p className="text-muted-foreground">
            Track performance and make decisions based on results
          </p>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground text-center max-w-lg mb-8">
              Outcomes connects your strategy to results. Generate MBRs, track OKRs,
              and make better operational decisions—all informed by your strategic direction.
            </p>

            {/* Feature Preview */}
            <div className="grid gap-4 md:grid-cols-3 w-full max-w-2xl mb-8">
              <div className="flex flex-col items-center p-4 rounded-lg bg-background border">
                <FileText className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-medium">Monthly Reviews</span>
                <span className="text-xs text-muted-foreground">Auto-generated MBRs</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg bg-background border">
                <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-medium">OKR Tracking</span>
                <span className="text-xs text-muted-foreground">Metrics tied to strategy</span>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg bg-background border">
                <CalendarCheck className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-medium">Quarterly Planning</span>
                <span className="text-xs text-muted-foreground">Strategy refresh cycles</span>
              </div>
            </div>

            {/* Notify Button */}
            {notifyRequested ? (
              <div className="flex items-center gap-2 text-green-600">
                <Bell className="h-4 w-4" />
                <span className="text-sm">We&apos;ll notify you when it&apos;s ready!</span>
              </div>
            ) : (
              <Button onClick={handleNotify} variant="outline">
                <Bell className="h-4 w-4 mr-2" />
                Notify me when available
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/project/[id]/outcomes/page.tsx
git commit -m "feat: add Outcomes fake door page"
```

---

## Task 9: Update Project Page Header

**Files:**
- Modify: `src/app/project/[id]/page.tsx:391-400`

**Step 1: Update header to reflect "Thinking" purpose**

Find the header section and update:

From:
```typescript
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {projectData?.name || 'Your Strategy'}
          </h1>
          <p className="text-muted-foreground">
            Feed inputs, have conversations with Luna, and build your decision stack.
          </p>
        </div>
```

To:
```typescript
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {projectData?.name || 'Thinking'}
          </h1>
          <p className="text-muted-foreground">
            Your second brain for strategy. Capture ideas, explore questions, and refine your thinking.
          </p>
        </div>
```

**Step 2: Verify no TypeScript errors**

Run: `npm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "refactor: update project page header for Thinking view"
```

---

## Task 10: Final Verification and Testing

**Files:**
- All modified files

**Step 1: Run full verification**

Run: `npm run verify`
Expected: All tests pass

**Step 2: Manual testing checklist**

Run: `npm run dev`

Test the following:
- [ ] Sidebar shows collapsible projects with Strategy/Thinking/Outcomes submenu
- [ ] No "New Chat" / "Upload" buttons at top of sidebar
- [ ] Project "..." menu has New Chat, Upload Document, Delete Project
- [ ] Clicking project name expands/collapses submenu
- [ ] Strategy link goes to `/project/[id]/strategy`
- [ ] Thinking link goes to `/project/[id]`
- [ ] Outcomes link goes to `/project/[id]/outcomes` with fake door
- [ ] Current page is highlighted in submenu
- [ ] Upload from project menu opens dialog for correct project
- [ ] Delete still works correctly

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add icon imports | `app-layout.tsx` |
| 2 | Remove Quick Actions | `app-layout.tsx` |
| 3 | Add upload project context state | `app-layout.tsx` |
| 4 | Expand project context menu | `app-layout.tsx` |
| 5 | Add collapsible project submenu | `app-layout.tsx` |
| 6 | Create Strategy page | `project/[id]/strategy/page.tsx` |
| 7 | Create Strategy API | `api/project/[id]/strategy/route.ts` |
| 8 | Create Outcomes fake door | `project/[id]/outcomes/page.tsx` |
| 9 | Update project page header | `project/[id]/page.tsx` |
| 10 | Final verification | All |

---

## References

- Design doc: `docs/plans/2026-01-13-project-navigation-restructure-design.md`
- JTBD positioning: `docs/positioning/jobs-to-be-done.md`
