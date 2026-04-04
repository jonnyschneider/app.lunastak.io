'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { getStatsigClient, logAndFlush } from '@/components/StatsigProvider';

interface EmptyProjectStateProps {
  onCreateProject: () => void;
}

export function EmptyProjectState({ onCreateProject }: EmptyProjectStateProps) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    logAndFlush('cta_create_project', 'empty-state');
    setIsCreating(true);
    try {
      await onCreateProject();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <Image
          src="/animated-logo-glitch.svg"
          alt="Luna"
          width={64}
          height={64}
          className="opacity-50"
        />

        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            No projects yet
          </h2>
          <p className="text-muted-foreground max-w-md">
            Create your first project to start building your Decision Stack.
          </p>
        </div>

        <Button
          onClick={handleCreateProject}
          disabled={isCreating}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {isCreating ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </div>
  );
}
