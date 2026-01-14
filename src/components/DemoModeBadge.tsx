'use client';

import { signIn } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function DemoModeBadge() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="destructive"
          className="cursor-pointer"
        >
          Demo Mode
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">You're exploring a demo project</p>
          <p className="text-sm text-muted-foreground">
            Your work won't be saved. Create an account to build your own strategy and keep your progress.
          </p>
          <Button
            onClick={() => signIn()}
            className="w-full"
            size="sm"
          >
            Create Account
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
