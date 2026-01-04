'use client';

import { useMemo, useState } from 'react';
import { StrategyStatements, Objective } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FakeDoorDialog } from './FakeDoorDialog';
import { InfoDialog } from './InfoDialog';

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
  conversationId: string;
  traceId: string;
}

export default function StrategyDisplay({ strategy, thoughts, conversationId, traceId }: StrategyDisplayProps) {
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const [fakeDoorConfig, setFakeDoorConfig] = useState<{
    name: string;
    description: string;
    feature: string;
  } | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoDialogConfig, setInfoDialogConfig] = useState<{
    title: string;
    content: string;
  } | null>(null);

  // Handle legacy objectives (string[]) by converting to new format
  const objectives: Objective[] = useMemo(() => {
    if (strategy.objectives.length === 0) return [];

    // Check if objectives are already in new format
    if (typeof strategy.objectives[0] === 'object' && 'id' in strategy.objectives[0]) {
      return strategy.objectives as Objective[];
    }

    // Convert legacy string[] format
    return convertLegacyObjectives(strategy.objectives as unknown as string[]);
  }, [strategy.objectives]);

  const handleFakeDoor = async (feature: string) => {
    console.log(`[Baseline] User clicked: ${feature}`);

    const featureConfig: Record<string, { name: string; description: string }> = {
      'Edit Vision': {
        name: 'Edit Vision',
        description: 'Edit and refine your vision statement.\n\nThis feature would let you directly modify the vision and regenerate related elements.',
      },
      'Edit Strategy': {
        name: 'Edit Strategy',
        description: 'Edit and refine your strategy statement.\n\nThis feature would let you directly modify the strategy and regenerate related elements.',
      },
      'Edit Objective': {
        name: 'Edit Objectives',
        description: 'Edit and refine your strategic objectives.\n\nThis feature would let you modify, add, or remove objectives with smart regeneration.',
      },
    };

    setFakeDoorConfig({
      ...featureConfig[feature],
      feature,
    });
    setFakeDoorOpen(true);
  };

  const handleFakeDoorInterest = async () => {
    if (!fakeDoorConfig) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        traceId,
        eventType: 'fake_door_click',
        eventData: { feature: fakeDoorConfig.feature },
      }),
    }).catch(err => console.error('Failed to log event:', err));

    console.log(`User interested in: ${fakeDoorConfig.name}`);
  };

  const showInfoModal = async (element: string, content: string) => {
    // Log to database
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        traceId,
        eventType: 'info_icon_view',
        eventData: { element },
      }),
    }).catch(err => console.error('Failed to log event:', err));

    // Show info dialog
    setInfoDialogConfig({
      title: element,
      content: content,
    });
    setInfoDialogOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Strategic Thinking Accordion */}
      {thoughts && (
        <Accordion type="single" collapsible className="bg-muted border border-border rounded-lg">
          <AccordionItem value="thinking" className="border-0">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="font-semibold text-foreground">
                How to talk to this strategy
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                {thoughts}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Strategy Output */}
      <div className="space-y-4">
        {/* Vision Card */}
        <div className="bg-primary rounded-lg p-6 shadow-sm relative group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-primary-foreground/70 uppercase tracking-wide">
              Vision
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => showInfoModal('Vision', 'A Vision statement describes your aspirational future state (3+ years). It should be customer-centric, specific, and inspiring but grounded in reality.\n\n**Like this...**\nTo organize the world\'s information and make it universally accessible and useful\n\n**Not this...**\nTo be the best-in-class solution provider')}
                className="text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors"
                title="Learn about Vision statements"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => handleFakeDoor('Edit Vision')}
                className="text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors opacity-0 group-hover:opacity-100"
                title="Edit Vision"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-lg font-medium text-primary-foreground leading-relaxed">
            {strategy.vision}
          </p>
        </div>

        {/* Strategy Card */}
        <div className="bg-primary/80 rounded-lg p-6 shadow-sm relative group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-primary-foreground/70 uppercase tracking-wide">
              Strategy
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => showInfoModal('Strategy', 'A Strategy statement describes your coherent set of choices for achieving the vision (12-18 months). It should provide direction and alignment without being tactical.\n\n**Like this...**\nTo capture an unrivalled store of data, understand it, and leverage it to better deliver what users want, when they want it.\n\n**Not this...**\nProvide innovative solutions to customers')}
                className="text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors"
                title="Learn about Strategy statements"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => handleFakeDoor('Edit Strategy')}
                className="text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors opacity-0 group-hover:opacity-100"
                title="Edit Strategy"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-lg font-medium text-primary-foreground leading-relaxed">
            {strategy.strategy}
          </p>
        </div>

        {/* Objectives Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Objectives
              </h3>
              <button
                onClick={() => showInfoModal('Objectives', 'Objectives are SMART, outcome-focused goals (12-18 months). The main text should be pithy and engaging. The timeframe appears in the top-left corner. Metric details (direction, name, value) appear below.\n\n**Like this...**\n[12M] Improve relevance by understanding content\n↑ Search accuracy | 30% lift in user satisfaction\n\n**Not this...**\nIncrease search accuracy by 30% in 12 months')}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Learn about Objectives"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {objectives.map((objective) => (
              <div
                key={objective.id}
                className="bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative group"
              >
                {/* Timeframe badge - top left */}
                {objective.metric.timeframe && (
                  <span className="absolute top-3 left-3 inline-block px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                    {objective.metric.timeframe}
                  </span>
                )}

                {/* Edit button - top right */}
                <button
                  onClick={() => handleFakeDoor('Edit Objective')}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit Objective"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Objective text */}
                <p className="text-sm font-medium text-foreground mb-3 mt-6">
                  {objective.pithy}
                </p>

                {/* Metric information */}
                {objective.metric.direction && objective.metric.metricName && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {objective.metric.direction === 'increase' ? '↑' : '↓'}
                    </span>
                    <span className="font-medium">
                      {objective.metric.metricName}
                    </span>
                    {objective.metric.metricValue && (
                      <>
                        <span>|</span>
                        <span>
                          {objective.metric.metricValue}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Opportunities Section - Blank with CTA */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Opportunities
              </h3>
              <button
                onClick={() => showInfoModal('Opportunities', 'Opportunities are specific actions (3-12 months) that support your objectives. Each should have clear deliverables and timelines.\n\n**Like this...**\nLaunch knowledge graph indexing (Q2) → Index 500M entities, integrate with search results, measure relevance lift\n\n**Not this...**\nImprove product features')}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Learn about Opportunities"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Define opportunities that support your objectives
            </p>
            <button
              onClick={() => handleFakeDoor('Create Opportunities')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Opportunities
            </button>
          </div>
        </div>

        {/* Principles Section - Blank with CTA */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Principles
              </h3>
              <button
                onClick={() => showInfoModal('Principles', 'Principles are "even/over" statements that clarify trade-offs and guide decisions. Keep them simple and memorable (4-6 maximum).\n\n**Like this...**\nUser experience even over short-term revenue\n\n**Not this...**\nWe value quality and excellence')}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Learn about Principles"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Define principles that guide your decision-making
            </p>
            <button
              onClick={() => handleFakeDoor('Define Principles')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Define Principles
            </button>
          </div>
        </div>
      </div>

      {fakeDoorConfig && (
        <FakeDoorDialog
          open={fakeDoorOpen}
          onOpenChange={setFakeDoorOpen}
          featureName={fakeDoorConfig.name}
          description={fakeDoorConfig.description}
          onInterest={handleFakeDoorInterest}
        />
      )}

      {infoDialogConfig && (
        <InfoDialog
          open={infoDialogOpen}
          onOpenChange={setInfoDialogOpen}
          title={infoDialogConfig.title}
          content={infoDialogConfig.content}
        />
      )}
    </div>
  );
}
