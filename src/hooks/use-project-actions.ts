import { useState, useCallback } from 'react';
import type { PaywallFeature } from '@/lib/contracts/paywall';

interface UseProjectActionsOptions {
  onSuccess?: () => void;
  triggerPaywall?: (feature: PaywallFeature) => Promise<boolean>;
}

interface UseProjectActionsReturn {
  createProject: () => Promise<string | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  isCreating: boolean;
  isDeleting: boolean;
}

export function useProjectActions(options: UseProjectActionsOptions = {}): UseProjectActionsReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const createProject = useCallback(async (): Promise<string | null> => {
    // Check paywall if provided
    if (options.triggerPaywall) {
      const blocked = await options.triggerPaywall('create_project');
      if (blocked) return null;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        const projectId = data.project?.id || data.id;
        options.onSuccess?.();
        return projectId;
      }
      console.error('Failed to create project');
      return null;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [options]);

  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        options.onSuccess?.();
        return true;
      }
      console.error('Failed to delete project');
      return false;
    } catch (error) {
      console.error('Failed to delete project:', error);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [options]);

  return {
    createProject,
    deleteProject,
    isCreating,
    isDeleting,
  };
}
