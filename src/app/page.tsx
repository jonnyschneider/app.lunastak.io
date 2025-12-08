'use client';

import { useState, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import ExtractionConfirm from '@/components/ExtractionConfirm';
import StrategyDisplay from '@/components/StrategyDisplay';
import FeedbackButtons from '@/components/FeedbackButtons';
import { Message, ExtractedContext, StrategyStatements } from '@/lib/types';

type FlowStep = 'chat' | 'extraction' | 'strategy';

export default function Home() {
  const [userId] = useState(() => `user_${Date.now()}`); // Temp user ID until auth
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('chat');
  const [extractedContext, setExtractedContext] = useState<ExtractedContext | null>(null);
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null);
  const [thoughts, setThoughts] = useState<string>('');
  const [traceId, setTraceId] = useState<string>('');

  // Start conversation on mount
  useEffect(() => {
    startConversation();
  }, []);

  const startConversation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      setConversationId(data.conversationId);
      setMessages([{
        id: `msg_${Date.now()}`,
        conversationId: data.conversationId,
        role: 'assistant',
        content: data.message,
        stepNumber: 1,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserResponse = async (response: string) => {
    if (!conversationId) return;

    // Add user message optimistically
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      role: 'user',
      content: response,
      stepNumber: messages.length + 1,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    try {
      const continueResponse = await fetch('/api/conversation/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userResponse: response }),
      });

      const data = await continueResponse.json();

      if (data.complete) {
        // Move to extraction step
        extractContext();
      } else {
        // Add assistant's next question
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}`,
          conversationId,
          role: 'assistant',
          content: data.message,
          stepNumber: data.stepNumber,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractContext = async () => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      const data = await response.json();
      setExtractedContext(data.extractedContext);
      setFlowStep('extraction');
    } catch (error) {
      console.error('Failed to extract context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmContext = async (context: ExtractedContext) => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, extractedContext: context }),
      });

      const data = await response.json();
      setStrategy(data.statements);
      setThoughts(data.thoughts);
      setTraceId(data.traceId);
      setFlowStep('strategy');
    } catch (error) {
      console.error('Failed to generate strategy:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Decision Stack</h1>

        {flowStep === 'chat' && (
          <div className="h-[600px]">
            <ChatInterface
              conversationId={conversationId}
              messages={messages}
              onUserResponse={handleUserResponse}
              isLoading={isLoading}
              isComplete={false}
              currentPhase="INITIAL"
            />
          </div>
        )}

        {flowStep === 'extraction' && extractedContext && (
          <ExtractionConfirm
            extractedContext={extractedContext}
            onConfirm={handleConfirmContext}
            onEdit={() => {}} // TODO: implement edit flow
          />
        )}

        {flowStep === 'strategy' && strategy && (
          <>
            <StrategyDisplay strategy={strategy} thoughts={thoughts} />
            <FeedbackButtons traceId={traceId} />
          </>
        )}
      </div>
    </main>
  );
}
