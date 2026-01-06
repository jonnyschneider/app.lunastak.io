'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ExtractionConfirm from '@/components/ExtractionConfirm';
import { ExtractedContextVariant } from '@/lib/types';

type ViewMode = 'user' | 'debug';

interface DimensionTag {
  id: string;
  dimension: string;
  confidence: string | null;
  reasoning: string | null;
}

interface Fragment {
  id: string;
  content: string;
  contentType: string;
  confidence: string | null;
  dimensionTags: DimensionTag[];
}

interface Synthesis {
  id: string;
  dimension: string;
  summary: string | null;
  keyThemes: string[];
  gaps: string[];
  confidence: string;
  fragmentCount: number;
}

interface Message {
  id: string;
  role: string;
  content: string;
  stepNumber: number;
}

interface ExtractionData {
  extractionRun: {
    id: string;
    projectId: string;
    conversationId: string | null;
    experimentVariant: string | null;
    fragmentIds: string[];
    synthesesBefore: any;
    synthesesAfter: any;
    modelUsed: string;
    createdAt: string;
  } | null;
  fragments: Fragment[];
  syntheses: Synthesis[];
  conversation: {
    id: string;
    messages: Message[];
  } | null;
  generatedOutput: any;
  extractedContext: ExtractedContextVariant | null;
  dimensionalCoverage: any;
  traceId?: string | null;
}

const DIMENSION_LABELS: Record<string, string> = {
  customer_market: 'Customer & Market',
  problem_opportunity: 'Problem & Opportunity',
  value_proposition: 'Value Proposition',
  differentiation_advantage: 'Differentiation',
  competitive_landscape: 'Competitive Landscape',
  business_model_economics: 'Business Model',
  go_to_market: 'Go-to-Market',
  product_experience: 'Product Experience',
  capabilities_assets: 'Capabilities & Assets',
  risks_constraints: 'Risks & Constraints',
};

export default function ExtractionPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ExtractionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('user');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/extraction/${id}`);
        if (!response.ok) {
          throw new Error('Extraction not found');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="animate-pulse">Loading extraction data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="text-destructive">Error: {error || 'No data'}</div>
      </div>
    );
  }

  const { extractionRun, fragments, syntheses, conversation, extractedContext: rawExtractedContext, traceId } = data;

  // Ensure reflective_summary has proper structure for ExtractionConfirm
  const extractedContext = rawExtractedContext ? {
    ...rawExtractedContext,
    reflective_summary: {
      strengths: rawExtractedContext.reflective_summary?.strengths || [],
      emerging: rawExtractedContext.reflective_summary?.emerging || [],
      opportunities_for_enrichment: rawExtractedContext.reflective_summary?.opportunities_for_enrichment || [],
      thought_prompt: rawExtractedContext.reflective_summary?.thought_prompt,
    },
  } : null;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header with View Toggle */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Extraction Details</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('user')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                User View
              </button>
              <button
                onClick={() => setViewMode('debug')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'debug'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                Debug View
              </button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            {extractionRun ? (
              <>
                <p>Extraction ID: <code className="bg-muted px-1 rounded">{extractionRun.id}</code></p>
                <p>Conversation ID: <code className="bg-muted px-1 rounded">{extractionRun.conversationId}</code></p>
                <p>Experiment: <span className="font-medium">{extractionRun.experimentVariant || 'N/A'}</span></p>
                <p>Model: <span className="font-medium">{extractionRun.modelUsed}</span></p>
                <p>Created: {new Date(extractionRun.createdAt).toLocaleString()}</p>
              </>
            ) : (
              <>
                <p>Trace ID: <code className="bg-muted px-1 rounded">{traceId}</code></p>
                {conversation && <p>Conversation ID: <code className="bg-muted px-1 rounded">{conversation.id}</code></p>}
                <p className="text-yellow-600">No ExtractionRun record (loaded from Trace)</p>
              </>
            )}
          </div>
        </div>

        {/* User View - Shows ExtractionConfirm as user would see it */}
        {viewMode === 'user' && (
          extractedContext ? (
            <>
              <ExtractionConfirm
                extractedContext={extractedContext}
                onGenerate={() => alert('Preview mode - Generate disabled')}
                onContinue={() => alert('Preview mode - Continue disabled')}
                isGenerating={false}
              />
              {/* Debug: show raw reflective_summary */}
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Debug: raw reflective_summary</summary>
                <pre className="mt-2 bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(data.extractedContext?.reflective_summary, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <div className="bg-muted rounded-lg p-8 text-center">
              <p className="text-muted-foreground">
                No extractedContext found in trace. This may be an older conversation.
              </p>
            </div>
          )
        )}

        {/* Debug View - Shows all internal data */}
        {viewMode === 'debug' && (
          <>
            {/* Conversation */}
            {conversation && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Conversation ({conversation.messages.length} messages)</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-4 bg-muted/30">
                  {conversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.role === 'assistant'
                          ? 'bg-primary/10 border-l-4 border-primary'
                          : 'bg-secondary/50 border-l-4 border-secondary'
                      }`}
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {msg.role === 'assistant' ? 'Assistant' : 'User'} (Step {msg.stepNumber})
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Extracted Fragments */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Extracted Fragments ({fragments.length})</h2>
              <div className="grid gap-4">
                {fragments.map((fragment) => (
                  <div key={fragment.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm">{fragment.content}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {fragment.dimensionTags.map((tag) => (
                            <span
                              key={tag.id}
                              className={`text-xs px-2 py-1 rounded-full ${
                                tag.confidence === 'HIGH'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : tag.confidence === 'MEDIUM'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {DIMENSION_LABELS[tag.dimension] || tag.dimension}
                              {tag.confidence && ` (${tag.confidence})`}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{fragment.contentType}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Dimensional Syntheses */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Dimensional Syntheses</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {syntheses.map((syn) => (
                  <div key={syn.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">
                        {DIMENSION_LABELS[syn.dimension] || syn.dimension}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          syn.confidence === 'HIGH'
                            ? 'bg-green-100 text-green-800'
                            : syn.confidence === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {syn.confidence} ({syn.fragmentCount} fragments)
                      </span>
                    </div>
                    {syn.summary && (
                      <p className="text-sm text-muted-foreground">{syn.summary}</p>
                    )}
                    {syn.keyThemes.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium">Key Themes:</span>
                        <ul className="text-xs text-muted-foreground list-disc list-inside">
                          {syn.keyThemes.map((theme, i) => (
                            <li key={i}>{theme}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {syn.gaps.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-orange-600">Gaps:</span>
                        <ul className="text-xs text-orange-600 list-disc list-inside">
                          {syn.gaps.map((gap, i) => (
                            <li key={i}>{gap}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Syntheses Diff */}
            {extractionRun && (extractionRun.synthesesBefore || extractionRun.synthesesAfter) && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Synthesis State (Before/After)</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Before</h3>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(extractionRun.synthesesBefore, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-2">After</h3>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(extractionRun.synthesesAfter, null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
