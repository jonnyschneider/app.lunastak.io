'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, Sparkles, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { OpportunityEditor } from './OpportunityEditor';
import { OpportunityCard } from './OpportunityCard';
import { SuccessMetric } from '@/lib/types';
import { getStatsigClient } from '@/components/StatsigProvider';

interface Opportunity {
  id: string;
  content: string;  // Legacy: "title\ndescription" format
  title?: string;
  description?: string;
  status: 'draft' | 'active' | 'complete';
  successMetrics?: SuccessMetric[];
  metadata?: {
    coachingDismissed?: boolean;
    objectiveIds?: string[];
    // Legacy support
    objectiveContributions?: { objectiveId: string; contribution: string }[];
  };
}

// Parse legacy content format
function parseOpportunityContent(content: string): { title: string; description: string } {
  const lines = content.split('\n');
  const title = lines[0] || '';
  const description = lines.slice(1).join('\n').trim();
  return { title, description };
}

interface ObjectiveForLinking {
  id: string;
  pithy?: string;
  objective?: string;
}

interface OpportunitySectionProps {
  projectId: string;
  objectives: ObjectiveForLinking[];
  onImproveWithAI?: () => void;
  compact?: boolean;
  readOnly?: boolean;
  // Global edit state
  editingCard?: { type: string; id?: string } | null;
  onStartEditing?: (id: string) => void;
  onStopEditing?: () => void;
  onDraftWithLuna?: () => void;
  /** Bump to trigger re-fetch (e.g. after generation completes) */
  refreshKey?: number;
}

export function OpportunitySection({
  projectId,
  objectives,
  onImproveWithAI,
  compact = false,
  readOnly = false,
  editingCard,
  onStartEditing,
  onDraftWithLuna,
  onStopEditing,
  refreshKey,
}: OpportunitySectionProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Derive editing state from global edit state
  const editingId = editingCard?.type === 'opportunity' ? (editingCard.id ?? null) : null;
  const isAdding = editingId === 'new';

  // Fetch opportunities on mount
  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch(`/api/project/${projectId}/content`);
      if (res.ok) {
        const data = await res.json();
        setOpportunities(
          data.content.filter((c: { type: string }) => c.type === 'opportunity')
        );
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities, refreshKey]);

  const handleCreate = async (
    content: string,
    status: 'draft' | 'complete',
    objectiveIds: string[],
    successMetrics: SuccessMetric[]
  ) => {
    setSaving(true);
    try {
      const parsed = parseOpportunityContent(content);
      const res = await fetch(`/api/project/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'opportunity',
          content: JSON.stringify({
            title: parsed.title,
            description: parsed.description,
            successMetrics,
          }),
          status,
          metadata: {
            objectiveIds,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(prev => [...prev, data.content]);
        onStopEditing?.();
      }
    } catch (error) {
      console.error('Failed to create opportunity:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    id: string,
    content: string,
    status: 'draft' | 'complete',
    objectiveIds: string[],
    successMetrics: SuccessMetric[]
  ) => {
    setSaving(true);
    try {
      const parsed = parseOpportunityContent(content);
      const res = await fetch(`/api/project/${projectId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          content: JSON.stringify({
            title: parsed.title,
            description: parsed.description,
            successMetrics,
          }),
          status,
          metadata: {
            objectiveIds,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(prev =>
          prev.map(o => o.id === id ? data.content : o)
        );
        onStopEditing?.();
      }
    } catch (error) {
      console.error('Failed to update opportunity:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/project/${projectId}/content?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setOpportunities(prev => prev.filter(o => o.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete opportunity:', error);
    }
  };

  const handleEdit = (id: string) => {
    onStartEditing?.(id);
  };

  const handleStartAdding = () => {
    onStartEditing?.('new');
  };

  const handleCancelEdit = () => {
    onStopEditing?.();
  };

  if (loading) {
    return (
      <div className="bg-ds-teal rounded-lg shadow-sm p-12 text-center">
        <p className="text-white/70">Loading opportunities...</p>
      </div>
    );
  }

  const hasOpportunities = opportunities.length > 0;
  const showPlaceholder = !hasOpportunities && !isAdding;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-lunastak-mid">
          Opportunities
        </h3>
        {!readOnly && !isAdding && !editingId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-lunastak-mid text-lunastak-mid hover:bg-lunastak-mid/10 gap-1 h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleStartAdding}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Add manually
              </DropdownMenuItem>
              {onDraftWithLuna && (
                <DropdownMenuItem onClick={() => {
                  getStatsigClient()?.logEvent('cta_draft_opportunities', 'opportunity-section', { projectId })
                  onDraftWithLuna?.()
                }}>
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Generate with Luna
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Cards grid */}
      {hasOpportunities && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {opportunities.map(opp => {
            // Parse content - could be JSON (new) or plain text (legacy)
            let title = opp.title || '';
            let description = opp.description || '';
            let successMetrics = opp.successMetrics || [];

            if (!title && opp.content) {
              try {
                const parsed = JSON.parse(opp.content);
                title = parsed.title || '';
                description = parsed.description || '';
                successMetrics = parsed.successMetrics || [];
              } catch {
                // Legacy format: first line is title
                const legacy = parseOpportunityContent(opp.content);
                title = legacy.title;
                description = legacy.description;
              }
            }

            const legacyContent = description ? `${title}\n${description}` : title;

            // Get objectiveIds - prefer new format, fall back to legacy contributions
            const objectiveIds = opp.metadata?.objectiveIds ||
              opp.metadata?.objectiveContributions?.map(c => c.objectiveId) ||
              [];

            return editingId === opp.id ? (
              <div key={opp.id} className="col-span-full">
                <OpportunityEditor
                  initialContent={legacyContent}
                  initialObjectiveIds={objectiveIds}
                  initialSuccessMetrics={successMetrics}
                  objectives={objectives}
                  onSave={(content, status, objIds, metrics) => handleUpdate(opp.id, content, status, objIds, metrics)}
                  onCancel={handleCancelEdit}
                  saving={saving}
                  compact={compact}
                  onImproveWithAI={onImproveWithAI}
                />
              </div>
            ) : (
              <OpportunityCard
                key={opp.id}
                id={opp.id}
                title={title}
                description={description}
                status={opp.status}
                successMetrics={successMetrics}
                objectiveIds={objectiveIds}
                objectives={objectives}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onImproveWithAI={onImproveWithAI}
                compact={compact}
                readOnly={readOnly}
              />
            );
          })}
        </div>
      )}

      {/* Inline editor for adding */}
      {isAdding && (
        <div className="mb-4">
          <OpportunityEditor
            objectives={objectives}
            onSave={handleCreate}
            onCancel={handleCancelEdit}
            saving={saving}
            compact={compact}
            onImproveWithAI={onImproveWithAI}
          />
        </div>
      )}


    </div>
  );
}
