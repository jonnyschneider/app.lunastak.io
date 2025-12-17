'use client';

import { useState, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import ExtractionConfirm from '@/components/ExtractionConfirm';
import StrategyDisplay from '@/components/StrategyDisplay';
import FeedbackButtons from '@/components/FeedbackButtons';
import { AppLayout } from '@/components/layout/app-layout';
import { IntroCard } from '@/components/IntroCard';
import { Message, ExtractedContext, EnhancedExtractedContext, ExtractedContextVariant, StrategyStatements, ConversationPhase } from '@/lib/types';

type FlowStep = 'chat' | 'extraction' | 'strategy';

export default function Home() {
  const [userId] = useState(() => `user_${Date.now()}`); // Temp user ID until auth
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('chat');
  const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null);
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null);
  const [thoughts, setThoughts] = useState<string>('');
  const [traceId, setTraceId] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL');
  const [experimentVariant, setExperimentVariant] = useState<string>('baseline-v1');
  const [showIntro, setShowIntro] = useState(true);

  const handleStartClick = () => {
    setShowIntro(false);
    startConversation();
  };

  const startConversation = async () => {
    setIsLoading(true);
    try {
      // Check for variant override in URL query params
      const params = new URLSearchParams(window.location.search);
      const variantOverride = params.get('variant');

      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...(variantOverride && { variantOverride })
        }),
      });

      const data = await response.json();
      setConversationId(data.conversationId);
      setExperimentVariant(data.experimentVariant || 'baseline-v1');
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
        body: JSON.stringify({
          conversationId,
          userResponse: response,
          currentPhase,
        }),
      });

      const data = await continueResponse.json();

      // Update phase based on response
      if (data.nextPhase) {
        setCurrentPhase(data.nextPhase);
      }

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

  const handleGenerate = async () => {
    if (!conversationId || !extractedContext) return;

    setIsLoading(true);
    try {
      console.log('[Generate] Starting generation request...');
      const startTime = Date.now();

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, extractedContext }),
      });

      console.log(`[Generate] Response received in ${Date.now() - startTime}ms, status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Generation failed: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('[Generate] Successfully parsed response data');

      setStrategy(data.statements);
      setThoughts(data.thoughts);
      setTraceId(data.traceId);
      setFlowStep('strategy');
    } catch (error) {
      console.error('[Generate] Failed to generate strategy:', error);
      alert(`Failed to generate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    // Log extraction choice
    if (conversationId) {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          eventType: 'extraction_choice',
          eventData: { choice: 'continue' },
        }),
      }).catch(err => console.error('Failed to log event:', err));
    }

    // Return to chat to continue exploring
    setCurrentPhase('QUESTIONING');
    setFlowStep('chat');

    // If there's a thought prompt from the reflective summary, add it as an assistant message
    if (extractedContext?.reflective_summary.thought_prompt) {
      const thoughtMessage: Message = {
        id: `msg_${Date.now()}`,
        conversationId: conversationId!,
        role: 'assistant',
        content: extractedContext.reflective_summary.thought_prompt,
        stepNumber: messages.length + 1,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, thoughtMessage]);
    }
  };

  const handleFlagForLater = async () => {
    // Log extraction choice
    if (conversationId) {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          eventType: 'extraction_choice',
          eventData: { choice: 'flag_for_later' },
        }),
      }).catch(err => console.error('Failed to log event:', err));
    }

    console.log('[Baseline] User flagged opportunities for later session');
    alert('Opportunities flagged for your next session. (Feature coming soon)');
  };

  const handleDismiss = async () => {
    // Log extraction choice
    if (conversationId) {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          eventType: 'extraction_choice',
          eventData: { choice: 'dismiss' },
        }),
      }).catch(err => console.error('Failed to log event:', err));
    }

    console.log('[Baseline] User dismissed opportunities');
    // Do nothing else - user can proceed to generate
  };

  return (
    <AppLayout experimentVariant={experimentVariant}>
      <main className="h-screen bg-gray-50 dark:bg-zinc-900 flex flex-col">
        <div className="container mx-auto py-8 flex-1 flex flex-col">
          {showIntro && (
            <IntroCard onStartClick={handleStartClick} />
          )}

          {!showIntro && flowStep === 'chat' && (
            <div className="flex-1 min-h-0">
              <ChatInterface
                conversationId={conversationId}
                messages={messages}
                onUserResponse={handleUserResponse}
                isLoading={isLoading}
                isComplete={false}
                currentPhase={currentPhase}
              />
            </div>
          )}

          {!showIntro && flowStep === 'extraction' && extractedContext && (
            <ExtractionConfirm
              extractedContext={extractedContext}
              onGenerate={handleGenerate}
              onContinue={handleContinue}
              onFlagForLater={handleFlagForLater}
              onDismiss={handleDismiss}
            />
          )}

          {!showIntro && flowStep === 'strategy' && strategy && conversationId && (
            <>
              <StrategyDisplay
                strategy={strategy}
                thoughts={thoughts}
                conversationId={conversationId}
                traceId={traceId}
              />
              <FeedbackButtons traceId={traceId} />
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
