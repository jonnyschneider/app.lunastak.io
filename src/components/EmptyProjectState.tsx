'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Plus, RotateCcw } from 'lucide-react';

interface EmptyProjectStateProps {
  onCreateProject: () => void;
  onRestoreDemo: () => void;
}

export function EmptyProjectState({ onCreateProject, onRestoreDemo }: EmptyProjectStateProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleRestoreDemo = async () => {
    setIsRestoring(true);
    try {
      await onRestoreDemo();
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreateProject = async () => {
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
            Create your first project to start building your strategy, or restore the demo project to explore how Luna works.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleCreateProject}
            disabled={isCreating || isRestoring}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>

          <Button
            variant="outline"
            onClick={handleRestoreDemo}
            disabled={isRestoring || isCreating}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {isRestoring ? 'Restoring...' : 'Restore Demo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
