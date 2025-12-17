'use client';

import { useMemo } from 'react';
import { StrategyStatements, Objective } from '@/lib/types';
import { convertLegacyObjectives } from '@/lib/placeholders';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface StrategyDisplayProps {
  strategy: StrategyStatements;
  thoughts?: string;
  conversationId: string;
  traceId: string;
}

export default function StrategyDisplay({ strategy, thoughts, conversationId, traceId }: StrategyDisplayProps) {
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

    // Log to database
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        traceId,
        eventType: 'fake_door_click',
        eventData: { feature },
      }),
    }).catch(err => console.error('Failed to log event:', err));

    alert(`${feature} feature coming soon!`);
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

    alert(content);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Strategic Thinking Accordion */}
      {thoughts && (
        <Accordion type="single" collapsible className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
          <AccordionItem value="thinking" className="border-0">
            <AccordionTrigger className="px-4 hover:no-underline">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                How to talk to this strategy
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap text-sm">
                {thoughts}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Strategy Output */}
      <div className="space-y-4">
        {/* Vision Card */}
        <div className="bg-zinc-800 dark:bg-zinc-700 rounded-lg p-6 shadow-sm relative group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Vision
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => showInfoModal('Vision', 'A Vision statement describes your aspirational future state (3+ years). It should be customer-centric, specific, and inspiring but grounded in reality.\n\nGood: "To be the trusted platform that empowers 1M creators to build sustainable businesses"\nWooden: "To be the best-in-class solution provider"')}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Learn about Vision statements"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => handleFakeDoor('Edit Vision')}
                className="text-zinc-500 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
                title="Edit Vision"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.vision}
          </p>
        </div>

        {/* Mission Card */}
        <div className="bg-zinc-700 dark:bg-zinc-600 rounded-lg p-6 shadow-sm relative group">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              Mission
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => showInfoModal('Mission', 'A Mission statement describes your coherent set of choices for achieving the vision (12-18 months). It should provide direction and alignment without being tactical.\n\nGood: "Build systematic demand through expert evaluation, develop trusted partnerships for delivery, create predictable foundations"\nWooden: "Provide innovative solutions to customers"')}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Learn about Mission statements"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => handleFakeDoor('Edit Mission')}
                className="text-zinc-400 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
                title="Edit Mission"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-lg font-medium text-white leading-relaxed">
            {strategy.mission}
          </p>
        </div>

        {/* Objectives Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Objectives
              </h3>
              <button
                onClick={() => showInfoModal('Objectives', 'Objectives are SMART, outcome-focused goals (12-18 months). Each should include a clear metric and target.\n\nGood: "100% of engagements address next-order strategic challenges"\nWooden: "Increase customer satisfaction"')}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow relative group"
              >
                <button
                  onClick={() => handleFakeDoor('Edit Objective')}
                  className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit Objective"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <div className="mb-3">
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">
                    {objective.metric.category}
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  {objective.pithy}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                  {objective.metric.full}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Initiatives Section - Blank with CTA */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Initiatives
              </h3>
              <button
                onClick={() => showInfoModal('Initiatives', 'Initiatives are specific actions (3-12 months) that support your objectives. Each should have clear deliverables and timelines.\n\nGood: "Launch Sniff Test offering (3 months) → Package, price <$1k, run 3-5 pilots"\nWooden: "Improve product features"')}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                title="Learn about Initiatives"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              Define initiatives that support your objectives
            </p>
            <button
              onClick={() => handleFakeDoor('Create Initiatives')}
              className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Create Initiatives
            </button>
          </div>
        </div>

        {/* Principles Section - Blank with CTA */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Principles
              </h3>
              <button
                onClick={() => showInfoModal('Principles', 'Principles are "even/over" statements that clarify trade-offs and guide decisions. Keep them simple and memorable (4-6 maximum).\n\nGood: "Strategic clients even over any paying client"\nWooden: "We value quality and excellence"')}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                title="Learn about Principles"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              Define principles that guide your decision-making
            </p>
            <button
              onClick={() => handleFakeDoor('Define Principles')}
              className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Define Principles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
