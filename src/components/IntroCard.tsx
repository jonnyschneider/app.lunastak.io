'use client';

import { EntryPointSelector } from './EntryPointSelector';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface IntroCardProps {
  onEntryPointSelect: (option: EntryPoint) => void;
  isLoading?: boolean;
}

export function IntroCard({ onEntryPointSelect, isLoading = false }: IntroCardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-3xl mx-auto">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 dark:text-zinc-400">Thinking...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Assistant intro message bubble */}
        <div className="flex justify-start">
          <div className="max-w-[80%] bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg p-4">
            <p className="whitespace-pre-wrap">
              I help founders and business leaders clarify their strategic thinking.
              {'\n\n'}
              Through a short conversation, I'll help you articulate your vision, strategy, and objectives.
              {'\n\n'}
              How would you like to start?
            </p>
          </div>
        </div>

        {/* Entry point options */}
        <div className="flex justify-start">
          <div className="w-full max-w-2xl">
            <EntryPointSelector onSelect={onEntryPointSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}
