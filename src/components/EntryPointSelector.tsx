'use client';

import {
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { SignInGateDialog } from './SignInGateDialog';
import { useState } from 'react';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface EntryPointOption {
  id: EntryPoint;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gated?: boolean;
}

const options: EntryPointOption[] = [
  {
    id: 'guided',
    icon: ChatBubbleLeftIcon,
    title: 'Guided Conversation',
    description: 'Answer a few questions to help us understand your business',
  },
  {
    id: 'document',
    icon: DocumentTextIcon,
    title: 'Upload Document',
    description: 'Start with an existing strategy doc or business plan',
    gated: true,
  },
  {
    id: 'canvas',
    icon: Squares2X2Icon,
    title: 'Start with Blank Canvas',
    description: 'Build your strategy using a blank Decision Stack template',
    gated: true,
  },
];

interface EntryPointSelectorProps {
  onSelect: (option: EntryPoint) => void;
}

export function EntryPointSelector({ onSelect }: EntryPointSelectorProps) {
  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState('');

  const handleOptionClick = (option: EntryPointOption) => {
    if (option.gated) {
      setGatedFeatureName(option.title);
      setGateDialogOpen(true);
    } else {
      onSelect(option.id);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {options.map((option) => {
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option)}
              className="relative flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
            >
              {option.gated && (
                <div className="absolute top-2 right-2">
                  <LockClosedIcon className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-medium text-foreground mb-2">
                {option.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      <SignInGateDialog
        open={gateDialogOpen}
        onOpenChange={setGateDialogOpen}
        featureName={gatedFeatureName}
      />
    </>
  );
}
