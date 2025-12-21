'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  BoltIcon,
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
    title: 'Start from Canvas',
    description: 'Build your strategy using a blank Decision Stack template',
  },
  {
    id: 'fast-track',
    icon: BoltIcon,
    title: 'Fast Track',
    description: 'Quick multiple choice questions with targeted follow-ups',
  },
];

interface EntryPointSelectorProps {
  onSelect: (option: EntryPoint) => void;
}

export function EntryPointSelector({ onSelect }: EntryPointSelectorProps) {
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Card
            key={option.id}
            className="cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
            onClick={() => onSelect(option.id)}
          >
            <CardContent className="flex items-start gap-4 p-4">
              <Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {option.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {option.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
