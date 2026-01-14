'use client';

import { signIn } from 'next-auth/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const APP_VERSION = '1.7.0';

export function DemoModeBadge() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              Demo v{APP_VERSION}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-center">
            <p>Exploring a demo project. Your work won't be saved.</p>
          </TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>
        <button
          onClick={() => signIn()}
          className="hover:text-foreground hover:underline transition-colors"
        >
          Sign in
        </button>
      </div>
    </TooltipProvider>
  );
}
