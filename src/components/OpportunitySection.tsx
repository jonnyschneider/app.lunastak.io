'use client';

import { useState, useEffect, useCallback } from 'react';
import { OpportunityEditor } from './OpportunityEditor';
import { OpportunityCard } from './OpportunityCard';
import { InfoDialog } from './InfoDialog';

interface ObjectiveContribution {
  objectiveId: string;
  contribution: string;
}

interface Opportunity {
  id: string;
  content: string;
  status: 'draft' | 'complete';
  metadata?: {
    coachingDismissed?: boolean;
    objectiveContributions?: ObjectiveContribution[];
  };
}

interface ObjectiveForLinking {
  id: string;
  pithy: string;
}

interface OpportunitySectionProps {
  projectId: string;
  objectives: ObjectiveForLinking[];
}

export function OpportunitySection({ projectId, objectives }: OpportunitySectionProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

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
    objectiveContributions: ObjectiveContribution[]
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/project/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'opportunity',
          content,
          status,
          metadata: {
            coachingDismissed: status === 'draft',
            objectiveContributions,
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
    objectiveContributions: ObjectiveContribution[]
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/project/${projectId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          content,
          status,
          metadata: {
            coachingDismissed: status === 'draft',
            objectiveContributions,
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
      <div className="bg-white border border-dashed border-[#0A2933] rounded-lg p-12 text-center">
        <p className="text-muted-foreground">Loading opportunities...</p>
      </div>
    );
  }

  const hasOpportunities = opportunities.length > 0;
  const showPlaceholder = !hasOpportunities && !isAdding;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Opportunities
          </h3>
          <button
            onClick={() => setInfoDialogOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Learn about Opportunities"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Placeholder state */}
      {showPlaceholder && (
        <div className="bg-white border border-dashed border-[#0A2933] rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">
            Define opportunities that support your objectives
          </p>
          <button
            onClick={handleStartAdding}
            className="px-6 py-2 bg-[#E0FF4F] text-[#0A2933] font-medium rounded-lg hover:bg-[#E0FF4F]/80 transition-colors"
          >
            Create Opportunities
          </button>
        </div>
      )}

      {/* Cards grid */}
      {hasOpportunities && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {opportunities.map(opp => (
            editingId === opp.id ? (
              <div key={opp.id} className="col-span-full">
                <OpportunityEditor
                  initialContent={opp.content}
                  initialContributions={opp.metadata?.objectiveContributions || []}
                  objectives={objectives}
                  onSave={(content, status, contributions) => handleUpdate(opp.id, content, status, contributions)}
                  onCancel={handleCancelEdit}
                  saving={saving}
                />
              </div>
            ) : (
              <OpportunityCard
                key={opp.id}
                id={opp.id}
                content={opp.content}
                status={opp.status as 'draft' | 'complete'}
                coachingDismissed={opp.metadata?.coachingDismissed}
                objectiveContributions={opp.metadata?.objectiveContributions}
                objectives={objectives}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )
          ))}
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
          />
        </div>
      )}

      {/* Add button when has opportunities but not adding */}
      {hasOpportunities && !isAdding && !editingId && (
        <button
          onClick={handleStartAdding}
          className="w-full py-3 border border-dashed border-muted-foreground/50 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          + Add opportunity
        </button>
      )}

      <InfoDialog
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        title="Opportunities"
        content={`Opportunities are areas of focus that support your objectives. They should be directional, not prescriptive - leave room for teams to figure out the HOW.

**Good opportunities have:**
- Clear connection to objectives
- Expected contribution articulated
- Rationale (why this, why now)

**Like this...**
"Prove builders will pay for selection coordination"

**Not this...**
"Build feature X by Q3"`}
      />
    </div>
  );
}
