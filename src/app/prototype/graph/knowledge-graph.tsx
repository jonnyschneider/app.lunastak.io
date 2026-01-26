'use client'

/**
 * PROTOTYPE: Force-directed knowledge graph
 * Throwaway code - not production ready
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Loading graph...</p>
    </div>
  ),
})

interface GraphNode {
  id: string
  type: 'fragment' | 'dimension'
  label: string
  content?: string
  confidence?: string
  size: number
  color: string
  x?: number
  y?: number
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  confidence: string
  width: number
}

interface KnowledgeGraphProps {
  nodes: GraphNode[]
  links: GraphLink[]
  dimensionLabels: Record<string, string>
}

export function KnowledgeGraph({ nodes, links, dimensionLabels }: KnowledgeGraphProps) {
  const graphRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Handle window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 80, // Account for header
      })
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Center graph on load
  useEffect(() => {
    if (graphRef.current) {
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 50)
      }, 500)
    }
  }, [nodes])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node)
    // Zoom to node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500)
      graphRef.current.zoom(2, 500)
    }
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // Custom node rendering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label
      const fontSize = node.type === 'dimension' ? 14 / globalScale : 10 / globalScale
      const nodeSize = node.size / globalScale

      // Draw node circle
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI)
      ctx.fillStyle = node.color
      ctx.fill()

      // Draw border for selected node
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 3 / globalScale
        ctx.stroke()
      }

      // Draw label
      ctx.font = `${node.type === 'dimension' ? 'bold ' : ''}${fontSize}px Sans-Serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Background for text
      const textWidth = ctx.measureText(label).width
      const padding = 2 / globalScale

      if (node.type === 'dimension') {
        // Dimension labels: white text
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(
          node.x! - textWidth / 2 - padding,
          node.y! + nodeSize + 2 / globalScale,
          textWidth + padding * 2,
          fontSize + padding * 2
        )
        ctx.fillStyle = '#fff'
        ctx.fillText(label, node.x!, node.y! + nodeSize + fontSize / 2 + 4 / globalScale)
      } else {
        // Fragment labels: only show on hover/select or high zoom
        if (selectedNode?.id === node.id || globalScale > 1.5) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.fillRect(
            node.x! - textWidth / 2 - padding,
            node.y! + nodeSize + 2 / globalScale,
            textWidth + padding * 2,
            fontSize + padding * 2
          )
          ctx.fillStyle = '#fff'
          ctx.fillText(label, node.x!, node.y! + nodeSize + fontSize / 2 + 4 / globalScale)
        }
      }
    },
    [selectedNode]
  )

  // Link styling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkColor = useCallback((link: any) => {
    const colors = {
      HIGH: 'rgba(34, 197, 94, 0.6)',
      MEDIUM: 'rgba(245, 158, 11, 0.4)',
      LOW: 'rgba(239, 68, 68, 0.3)',
    }
    return colors[link.confidence as keyof typeof colors] || 'rgba(100, 100, 100, 0.3)'
  }, [])

  return (
    <div className="relative w-full h-full bg-slate-950">
      <ForceGraph2D
        ref={graphRef}
        graphData={{ nodes, links }}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath()
          ctx.arc(node.x!, node.y!, node.size + 5, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
        }}
        linkColor={linkColor}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkWidth={(link: any) => link.width}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-slate-900/90 p-3 rounded-lg text-xs">
        <div className="font-semibold mb-2 text-white">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-300">High confidence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-slate-300">Medium confidence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-300">Low confidence</span>
          </div>
          <div className="border-t border-slate-700 my-2" />
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="text-slate-300">Dimension (larger)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-slate-300">Fragment (smaller)</span>
          </div>
        </div>
        <div className="mt-3 text-slate-400">
          Node size = # of dimension connections
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="absolute top-4 right-4 w-80 bg-slate-900/95 p-4 rounded-lg shadow-xl">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-semibold text-white">
              {selectedNode.type === 'dimension' ? 'Dimension' : 'Fragment'}
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">
                {selectedNode.type === 'dimension' ? 'Name' : 'Theme'}
              </div>
              <div className="text-white font-medium">{selectedNode.label}</div>
            </div>

            {selectedNode.confidence && (
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">
                  Confidence
                </div>
                <div
                  className={`font-medium ${
                    selectedNode.confidence === 'HIGH'
                      ? 'text-green-400'
                      : selectedNode.confidence === 'MEDIUM'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {selectedNode.confidence}
                </div>
              </div>
            )}

            {selectedNode.content && (
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">
                  Content
                </div>
                <div className="text-slate-300 text-sm mt-1 max-h-48 overflow-y-auto">
                  {selectedNode.content.replace(/^\*\*(.+?)\*\*\n\n/, '')}
                </div>
              </div>
            )}

            {selectedNode.type === 'fragment' && (
              <button className="w-full mt-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded transition-colors">
                Edit Fragment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-500">
        Click node to inspect • Scroll to zoom • Drag to pan • Drag nodes to reposition
      </div>
    </div>
  )
}
