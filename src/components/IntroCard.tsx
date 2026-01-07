'use client';

import Image from 'next/image';
import { EntryPointSelector } from './EntryPointSelector';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface IntroCardProps {
  onEntryPointSelect: (option: EntryPoint) => void;
  isLoading?: boolean;
  isAuthenticated?: boolean;
}

export function IntroCard({ onEntryPointSelect, isLoading = false, isAuthenticated = false }: IntroCardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-4xl mx-auto">
        <div className="flex-1 flex items-center justify-center p-6">
          <Image
            src="/animated-logo-glitch.svg"
            alt="Luna"
            width={48}
            height={48}
            className="animate-pulse"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Luna greeting */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Let&apos;s clarify your strategy
            </h1>
            <p className="text-muted-foreground max-w-md">
              &#128075; I'm Luna, the green blob. I don't look very smart, but I ask great questions (and, I'm a really good listener). 
            </p>
          </div>
          <Image
            src="/animated-logo-glitch.svg"
            alt="Luna"
            width={56}
            height={56}
          />
        </div>

        {/* Entry point options */}
        <div className="pt-4">
          <EntryPointSelector onSelect={onEntryPointSelect} isAuthenticated={isAuthenticated} />
        </div>
      </div>
    </div>
  );
}
