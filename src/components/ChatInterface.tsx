'use client';

import { useState } from 'react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/solid';
import { Message, ConversationPhase } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Button } from '@/components/ui/button';
import { EntryPointSelector } from '@/components/EntryPointSelector';
import { MoreHorizontal, Crosshair } from 'lucide-react';

type EntryPoint = 'guided' | 'document' | 'canvas' | 'fast-track';

interface ChatInterfaceProps {
  conversationId: string | null;
  messages: Message[];
  onUserResponse: (response: string) => void;
  onEntryPointSelect?: (option: EntryPoint) => void;
  onGenerateStrategy?: () => void;
  onDeferToDeepDive?: (messageContent: string, messageId: string) => void;
  isLoading: boolean;
  isComplete: boolean;
  currentPhase: ConversationPhase;
  traceId?: string;
  earlyExitOffered?: boolean;
  suggestedQuestion?: string | null;
}

export default function ChatInterface({
  conversationId,
  messages,
  onUserResponse,
  onEntryPointSelect,
  onGenerateStrategy,
  onDeferToDeepDive,
  isLoading,
  isComplete,
  currentPhase,
  traceId,
  earlyExitOffered,
  suggestedQuestion,
}: ChatInterfaceProps) {
  const [userInput, setUserInput] = useState('');
  const [entryPointSheetOpen, setEntryPointSheetOpen] = useState(false);

  // Check if user has started the conversation (any user messages exist)
  const hasUserResponded = messages.some((m) => m.role === 'user');

  const getPlaceholderText = () => {
    return 'Type your response...';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    onUserResponse(userInput);
    setUserInput('');
  };

  const handleAlternateOptionsClick = () => {
    setEntryPointSheetOpen(true);
  };

  const handleEntryPointSelection = (option: EntryPoint) => {
    setEntryPointSheetOpen(false);
    onEntryPointSelect?.(option);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {/* Context menu for assistant messages */}
              {message.role === 'assistant' && onDeferToDeepDive && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 self-start mt-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => onDeferToDeepDive(message.content, message.id)}
                      >
                        <Crosshair className="h-4 w-4 mr-2" />
                        Defer to Deep Dive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Entry point options link - only show before user has responded */}
            {message.role === 'assistant' && message.stepNumber === 1 && !hasUserResponded && (
              <div className="flex justify-start mt-2">
                <button
                  onClick={handleAlternateOptionsClick}
                  className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                >
                  see other options to get started?
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-4">
              <EllipsisHorizontalIcon className="w-6 h-6 text-primary animate-[pulse_3s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* Early exit card with Generate button + suggested question */}
        {earlyExitOffered && !isLoading && (
          <div className="space-y-4">
            {/* Generate Strategy button */}
            <div className="flex justify-center py-2">
              <Button
                onClick={onGenerateStrategy}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base font-semibold"
              >
                Generate Strategy
              </Button>
            </div>

            {/* Divider with "or" */}
            <div className="flex items-center gap-4 px-4">
              <div className="flex-1 border-t border-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Suggested follow-up question as chat bubble */}
            {suggestedQuestion && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-4 bg-muted text-foreground">
                  <p className="whitespace-pre-wrap">{suggestedQuestion}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      {!isComplete && (
        <form onSubmit={handleSubmit} className="border-t border-border p-4">
          <div className="flex gap-2 items-end">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={getPlaceholderText()}
              disabled={isLoading}
              rows={8}
              className="flex-1 px-4 py-3 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Kbd>⌘</Kbd><Kbd>Enter</Kbd>
            <span className="mx-1">or</span>
            <Kbd>Ctrl</Kbd><Kbd>Enter</Kbd>
            <span className="ml-1">to send</span>
          </p>
        </form>
      )}

      {/* Entry point selection sheet */}
      <Sheet open={entryPointSheetOpen} onOpenChange={setEntryPointSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader className="mb-6">
            <SheetTitle>Choose how to get started</SheetTitle>
            <SheetDescription>
              Select an option that works best for you
            </SheetDescription>
          </SheetHeader>
          <EntryPointSelector onSelect={handleEntryPointSelection} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
