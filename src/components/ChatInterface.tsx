'use client';

import { useState } from 'react';
import { Message } from '@/lib/types';

interface ChatInterfaceProps {
  conversationId: string | null;
  messages: Message[];
  onUserResponse: (response: string) => void;
  isLoading: boolean;
  isComplete: boolean;
  currentPhase: string;
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
    if (currentPhase === 'LENS_SELECTION') {
      return 'Type A, B, C, D, or E...';
    }
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <p className="text-gray-500">Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {!isComplete && (
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={getPlaceholderText()}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
