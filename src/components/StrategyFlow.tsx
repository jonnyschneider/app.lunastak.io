import { StrategyStatements } from '@/lib/types';
import ReactFlow, { 
  Node, 
  Edge,
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  NodeTypes,
  EdgeTypes 
} from 'reactflow';
import { useMemo, useEffect } from 'react';
import 'reactflow/dist/style.css';

interface StrategyFlowProps {
  strategy: StrategyStatements;
}

// Define node and edge types outside component
const nodeTypes: NodeTypes = {};
const edgeTypes: EdgeTypes = {};

// Updated styles with explicit dimensions
const flowStyles = {
  width: '100%',
  height: '600px',
  background: 'white',
  display: 'flex',
  flex: 1,
};

function FlowContent({ strategy }: StrategyFlowProps) {
  console.log('FlowContent received strategy:', strategy);

  const nodes = useMemo(() => {
    console.log('Calculating nodes for:', strategy);
    return [
      {
        id: 'vision',
        type: 'input',
        data: { label: `Vision:\n${strategy.vision}` },
        position: { x: 250, y: 0 },
        className: 'bg-blue-100 p-4 rounded-lg shadow',
      },
      {
        id: 'mission',
        data: { label: `Mission:\n${strategy.mission}` },
        position: { x: 250, y: 100 },
        className: 'bg-green-100 p-4 rounded-lg shadow',
      },
      ...strategy.objectives.map((obj, index) => ({
        id: `objective-${index}`,
        data: { label: obj },
        position: { x: index * 200, y: 200 },
        className: 'bg-yellow-100 p-4 rounded-lg shadow',
      })),
    ];
  }, [strategy]);

  const edges = useMemo(() => [
    {
      id: 'vision-mission',
      source: 'vision',
      target: 'mission',
      markerEnd: { type: MarkerType.ArrowClosed },
      className: 'stroke-gray-400',
    },
    ...strategy.objectives.map((_, index) => ({
      id: `mission-objective-${index}`,
      source: 'mission',
      target: `objective-${index}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      className: 'stroke-gray-400',
    })),
  ], [strategy.objectives]);

  useEffect(() => {
    // Force a resize event after mounting
    window.dispatchEvent(new Event('resize'));
  }, []);

  return (
    <div style={flowStyles} className="flow-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        style={{ width: '100%', height: '100%' }}
        className="flow-instance"
        onInit={() => console.log('ReactFlow initialized')}
        onError={(error) => console.error('ReactFlow error:', error)}
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function StrategyFlow(props: StrategyFlowProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px' }}>
      <ReactFlowProvider>
        <FlowContent {...props} />
      </ReactFlowProvider>
    </div>
  );
}
