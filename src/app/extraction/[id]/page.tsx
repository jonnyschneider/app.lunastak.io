'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ExtractionConfirm from '@/components/ExtractionConfirm';
import { ExtractedContextVariant } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type ViewMode = 'user' | 'data';

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
                onClick={() => setViewMode('data')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'data'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                Data View
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

        {/* Data View - Shows all internal data */}
        {viewMode === 'data' && (
          <>
            {/* Conversation - Collapsed by default */}
            {conversation && (
              <section>
                <Accordion type="single" collapsible>
                  <AccordionItem value="conversation" className="border-none">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                      Conversation ({conversation.messages.length} messages)
                    </AccordionTrigger>
                    <AccordionContent>
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

            {/* Dimensional Coverage Bar Chart */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Dimensional Coverage</h2>
              <div className="border rounded-lg p-4 bg-card">
                <div className="space-y-2">
                  {syntheses.map((syn) => {
                    const maxFragments = Math.max(...syntheses.map(s => s.fragmentCount), 1);
                    const percentage = (syn.fragmentCount / maxFragments) * 100;
                    return (
                      <div key={syn.id} className="flex items-center gap-3">
                        <div className="w-36 text-xs font-medium truncate" title={DIMENSION_LABELS[syn.dimension] || syn.dimension}>
                          {DIMENSION_LABELS[syn.dimension] || syn.dimension}
                        </div>
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              syn.confidence === 'HIGH'
                                ? 'bg-green-500'
                                : syn.confidence === 'MEDIUM'
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-8 text-xs text-muted-foreground text-right tabular-nums">
                          {syn.fragmentCount}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Total fragments: <span className="font-medium text-foreground">{fragments.length}</span>
                  </span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                      High
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-yellow-500" />
                      Medium
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-gray-400" />
                      Low
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Dimensional Syntheses - Compact Table */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Dimensional Syntheses</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Dimension</th>
                      <th className="text-left p-3 font-medium">Summary</th>
                      <th className="text-center p-3 font-medium w-20">Fragments</th>
                      <th className="text-center p-3 font-medium w-24">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {syntheses.map((syn) => (
                      <tr key={syn.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium whitespace-nowrap">
                          {DIMENSION_LABELS[syn.dimension] || syn.dimension}
                        </td>
                        <td className="p-3">
                          {syn.summary ? (
                            <div className="space-y-2">
                              <p className="text-muted-foreground line-clamp-2">{syn.summary}</p>
                              {(syn.keyThemes.length > 0 || syn.gaps.length > 0) && (
                                <Accordion type="single" collapsible className="w-full">
                                  {syn.keyThemes.length > 0 && (
                                    <AccordionItem value="themes" className="border-none">
                                      <AccordionTrigger className="text-xs py-1 hover:no-underline">
                                        Key Themes ({syn.keyThemes.length})
                                      </AccordionTrigger>
                                      <AccordionContent className="pt-1">
                                        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                                          {syn.keyThemes.map((theme, i) => (
                                            <li key={i}>{theme}</li>
                                          ))}
                                        </ul>
                                      </AccordionContent>
                                    </AccordionItem>
                                  )}
                                  {syn.gaps.length > 0 && (
                                    <AccordionItem value="gaps" className="border-none">
                                      <AccordionTrigger className="text-xs py-1 hover:no-underline text-orange-600">
                                        Gaps ({syn.gaps.length})
                                      </AccordionTrigger>
                                      <AccordionContent className="pt-1">
                                        <ul className="text-xs text-orange-600 list-disc list-inside space-y-0.5">
                                          {syn.gaps.map((gap, i) => (
                                            <li key={i}>{gap}</li>
                                          ))}
                                        </ul>
                                      </AccordionContent>
                                    </AccordionItem>
                                  )}
                                </Accordion>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 italic">No data yet</span>
                          )}
                        </td>
                        <td className="p-3 text-center tabular-nums">
                          {syn.fragmentCount}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              syn.confidence === 'HIGH'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : syn.confidence === 'MEDIUM'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {syn.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
