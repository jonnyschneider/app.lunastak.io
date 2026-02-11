'use client';

import { useState, useEffect, useCallback } from 'react';
import { OpportunityEditor } from './OpportunityEditor';
import { OpportunityCard } from './OpportunityCard';
import { SuccessMetric } from '@/lib/types';

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
}

export function OpportunitySection({ projectId, objectives, onImproveWithAI, compact = false, readOnly = false }: OpportunitySectionProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
  }, [fetchOpportunities]);

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
        setIsAdding(false);
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
        setEditingId(null);
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
    setEditingId(id);
    setIsAdding(false);
  };

  const handleStartAdding = () => {
    setIsAdding(true);
    setEditingId(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
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
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${readOnly ? 'text-ds-neon' : 'text-ds-teal'}`}>
          Opportunities
        </h3>
      </div>

      {/* Placeholder state */}
      {showPlaceholder && (
        <div className={`${readOnly ? '' : 'bg-ds-teal rounded-lg shadow-sm border border-dashed border-white/30 p-12'} text-center`}>
          <p className="text-white/70 mb-4">
            {readOnly ? 'No opportunities defined yet' : 'Define opportunities that support your objectives'}
          </p>
          {!readOnly && (
            <button
              onClick={handleStartAdding}
              className="px-6 py-2 bg-ds-neon text-ds-teal font-medium rounded-lg hover:bg-ds-neon/90 transition-colors"
            >
              Create Opportunities
            </button>
          )}
        </div>
      )}

      {/* Cards grid */}
      {hasOpportunities && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
              />
            );
          })}
        </div>
      )}

      {/* Inline editor for adding */}
      {isAdding && !editingId && (
        <div className="mb-4">
          <OpportunityEditor
            objectives={objectives}
            onSave={handleCreate}
            onCancel={handleCancelAdd}
            saving={saving}
            compact={compact}
            onImproveWithAI={onImproveWithAI}
          />
        </div>
      )}

      {/* Add button when has opportunities but not adding */}
      {!readOnly && hasOpportunities && !isAdding && !editingId && (
        <button
          onClick={handleStartAdding}
          className="w-full py-3 border border-dashed border-muted-foreground/50 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          + Add opportunity
        </button>
      )}

    </div>
  );
}
