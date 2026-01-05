'use client';

import {
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface EntryPointOption {
  id: EntryPoint;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
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
  },
  {
    id: 'canvas',
    icon: Squares2X2Icon,
    title: 'Start with Blank Canvas',
    description: 'Build your strategy using a blank Decision Stack template',
  },
];

interface EntryPointSelectorProps {
  onSelect: (option: EntryPoint) => void;
}

export function EntryPointSelector({ onSelect }: EntryPointSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className="flex flex-col items-center text-center p-6 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors"
          >
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
  );
}
