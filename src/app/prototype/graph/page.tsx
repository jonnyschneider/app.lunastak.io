/**
 * PROTOTYPE: Knowledge Graph Visualization
 *
 * This is a throwaway prototype to explore fragment visualization.
 * NOT production code - will be deleted.
 */

import { prisma } from '@/lib/db'
import { DIMENSION_CONTEXT } from '@/lib/constants/dimensions'
import { KnowledgeGraph } from './knowledge-graph'

async function getProjectWithFragments(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      fragments: {
        where: { status: 'active' },
        include: {
          dimensionTags: true,
        },
        orderBy: { capturedAt: 'desc' },
      },
    },
  })
  return project
}

async function getFirstProject() {
  // For prototype: just grab first project with fragments
  const project = await prisma.project.findFirst({
    where: {
      fragments: { some: { status: 'active' } },
    },
    include: {
      fragments: {
        where: { status: 'active' },
        include: {
          dimensionTags: true,
        },
        orderBy: { capturedAt: 'desc' },
      },
    },
  })
  return project
}

export default async function GraphPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const params = await searchParams
  const project = params.projectId
    ? await getProjectWithFragments(params.projectId)
    : await getFirstProject()

  if (!project) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold">No project found</h1>
        <p className="text-muted-foreground mt-2">
          Create a project and have a conversation first.
        </p>
      </div>
    )
  }

  // Transform data for the graph
  const graphData = buildGraphData(project.fragments)

  return (
    <div className="h-screen flex flex-col">
      <header className="p-4 border-b bg-background">
        <h1 className="text-lg font-semibold">Knowledge Graph: {project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.fragments.length} fragments across {graphData.dimensionCount} dimensions
        </p>
      </header>
      <div className="flex-1">
        <KnowledgeGraph
          nodes={graphData.nodes}
          links={graphData.links}
          dimensionLabels={graphData.dimensionLabels}
        />
      </div>
    </div>
  )
}

interface Fragment {
  id: string
  content: string
  confidence: string | null
  dimensionTags: {
    id: string
    dimension: string
    confidence: string | null
  }[]
}

function buildGraphData(fragments: Fragment[]) {
  type NodeType = {
    id: string
    type: 'fragment' | 'dimension'
    label: string
    content?: string
    confidence?: string
    size: number
    color: string
  }

  type LinkType = {
    source: string
    target: string
    confidence: string
    width: number
  }

  const nodes: NodeType[] = []
  const links: LinkType[] = []
  const dimensionsUsed = new Set<string>()
  const dimensionLabels: Record<string, string> = {}

  // Dimension colors
  const dimensionColors: Record<string, string> = {
    CUSTOMER_MARKET: '#3b82f6',
    PROBLEM_OPPORTUNITY: '#ef4444',
    VALUE_PROPOSITION: '#22c55e',
    DIFFERENTIATION_ADVANTAGE: '#f59e0b',
    COMPETITIVE_LANDSCAPE: '#8b5cf6',
    BUSINESS_MODEL_ECONOMICS: '#ec4899',
    GO_TO_MARKET: '#06b6d4',
    PRODUCT_EXPERIENCE: '#84cc16',
    CAPABILITIES_ASSETS: '#6366f1',
    RISKS_CONSTRAINTS: '#f97316',
    STRATEGIC_INTENT: '#14b8a6',
  }

  // First pass: collect all dimensions
  fragments.forEach((fragment) => {
    fragment.dimensionTags.forEach((tag) => {
      dimensionsUsed.add(tag.dimension)
    })
  })

  // Create dimension nodes
  dimensionsUsed.forEach((dim) => {
    const context = DIMENSION_CONTEXT[dim as keyof typeof DIMENSION_CONTEXT]
    dimensionLabels[dim] = context?.name || dim
    nodes.push({
      id: `dim-${dim}`,
      type: 'dimension',
      label: context?.name || dim,
      size: 20,
      color: dimensionColors[dim] || '#666',
    })
  })

  // Create fragment nodes and links
  fragments.forEach((fragment) => {
    // Extract theme name from content (format: **Theme Name**\n\nContent)
    const match = fragment.content.match(/^\*\*(.+?)\*\*/)
    const label = match ? match[1] : fragment.content.slice(0, 40) + '...'

    // Size based on number of dimension connections (centrality proxy)
    const connectionCount = fragment.dimensionTags.length
    const baseSize = 8
    const size = baseSize + connectionCount * 3

    // Color based on confidence
    const confidenceColors = {
      HIGH: '#22c55e',
      MEDIUM: '#f59e0b',
      LOW: '#ef4444',
    }
    const color = confidenceColors[fragment.confidence as keyof typeof confidenceColors] || '#666'

    nodes.push({
      id: fragment.id,
      type: 'fragment',
      label,
      content: fragment.content,
      confidence: fragment.confidence || undefined,
      size,
      color,
    })

    // Create links to dimensions
    fragment.dimensionTags.forEach((tag) => {
      const confidenceWidth = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      }
      links.push({
        source: fragment.id,
        target: `dim-${tag.dimension}`,
        confidence: tag.confidence || 'MEDIUM',
        width: confidenceWidth[tag.confidence as keyof typeof confidenceWidth] || 1,
      })
    })
  })

  return {
    nodes,
    links,
    dimensionCount: dimensionsUsed.size,
    dimensionLabels,
  }
}
