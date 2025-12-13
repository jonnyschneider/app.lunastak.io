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
}

export default function ChatInterface({
  conversationId,
  messages,
  onUserResponse,
  isLoading,
  isComplete,
  currentPhase,
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

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 dark:text-zinc-400">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {!isComplete && (
        <form onSubmit={handleSubmit} className="border-t border-zinc-200 dark:border-zinc-700 p-4">
          <div className="flex gap-2 items-end">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={getPlaceholderText()}
              disabled={isLoading}
              rows={8}
              className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
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
              className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send
          </p>
        </form>
      )}
    </div>
  );
}
