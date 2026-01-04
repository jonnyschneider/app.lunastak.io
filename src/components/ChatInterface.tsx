'use client';

import { useState } from 'react';
import { Message, ConversationPhase } from '@/lib/types';

interface ChatInterfaceProps {
  conversationId: string | null;
  messages: Message[];
  onUserResponse: (response: string) => void;
  isLoading: boolean;
  isComplete: boolean;
  currentPhase: ConversationPhase;
  traceId?: string;
}

export default function ChatInterface({
  conversationId,
  messages,
  onUserResponse,
  isLoading,
  isComplete,
  currentPhase,
  traceId,
}: ChatInterfaceProps) {
  const [userInput, setUserInput] = useState('');

  const getPlaceholderText = () => {
    return 'Type your response...';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    onUserResponse(userInput);
    setUserInput('');
  };

  const handleFakeDoorClick = async () => {
    // Log fake door click
    if (conversationId) {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          ...(traceId && { traceId }),
          eventType: 'fake_door_click',
          eventData: { feature: 'alternate_start_options' },
        }),
      }).catch(err => console.error('Failed to log event:', err));
    }

    alert('Alternative start options coming soon!');
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
            </div>

            {/* Fake door link for first assistant message */}
            {message.role === 'assistant' && message.stepNumber === 1 && (
              <div className="flex justify-start mt-2">
                <button
                  onClick={handleFakeDoorClick}
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
              <p className="text-muted-foreground">Thinking...</p>
            </div>
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
          <p className="text-xs text-muted-foreground mt-2">
            Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send
          </p>
        </form>
      )}
    </div>
  );
}
