'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ChatInterface from '@/components/ChatInterface';
import ExtractionConfirm from '@/components/ExtractionConfirm';
import StrategyDisplay from '@/components/StrategyDisplay';
import FeedbackButtons from '@/components/FeedbackButtons';
import { AppLayout } from '@/components/layout/app-layout';
import { IntroCard } from '@/components/IntroCard';
import { RegistrationBanner } from '@/components/RegistrationBanner';
import { FeedbackModal } from '@/components/FeedbackModal';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentSummary } from '@/components/DocumentSummary';
import { EntryPointSelector } from '@/components/EntryPointSelector';
import { FakeDoorDialog } from '@/components/FakeDoorDialog';
import { ExtractionProgress, ExtractionStep } from '@/components/ExtractionProgress';
import { Message, ExtractedContext, EnhancedExtractedContext, ExtractedContextVariant, StrategyStatements, ConversationPhase } from '@/lib/types';
import { AddDeepDiveDialog } from '@/components/add-deep-dive-dialog';

type FlowStep = 'intro' | 'upload' | 'document-summary' | 'chat' | 'extracting' | 'extraction' | 'strategy';

export default function Home() {
  const { data: session } = useSession();
  const [guestUserId, setGuestUserId] = useState<string | null>(null); // Set from API when guest session starts
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('intro');
  const [extractedContext, setExtractedContext] = useState<ExtractedContextVariant | null>(null);
  const [dimensionalCoverage, setDimensionalCoverage] = useState<any>(null); // [E2] Dimensional coverage data
  const [strategy, setStrategy] = useState<StrategyStatements | null>(null);
  const [thoughts, setThoughts] = useState<string>('');
  const [traceId, setTraceId] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>('INITIAL');
  const [experimentVariant, setExperimentVariant] = useState<string>('baseline-v1');
  const [showIntro, setShowIntro] = useState(true);
  const [documentContext, setDocumentContext] = useState<{
    extractedText: string;
    filename: string;
  } | null>(null);
  const [documentSummary, setDocumentSummary] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [fakeDoorOpen, setFakeDoorOpen] = useState(false);
  const [fakeDoorFeature, setFakeDoorFeature] = useState<{
    name: string;
    description: string;
    eventData: Record<string, any>;
  } | null>(null);
  const [showRegistrationBanner, setShowRegistrationBanner] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>('starting');
  const [extractionError, setExtractionError] = useState<string | undefined>();
  const [earlyExitOffered, setEarlyExitOffered] = useState(false);
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null);

  // Deep dive deferral state
  const [userProjectId, setUserProjectId] = useState<string | null>(null);
  const [deepDiveDialogOpen, setDeepDiveDialogOpen] = useState(false);
  const [deferralTopic, setDeferralTopic] = useState('');
  const [deferralMessageId, setDeferralMessageId] = useState<string | undefined>();

  // Show registration banner when strategy is displayed and user is not authenticated
  useEffect(() => {
    if (flowStep === 'strategy' && !session) {
      setShowRegistrationBanner(true);
    }
  }, [flowStep, session]);

  // Fetch user's project ID for deep dive deferral
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/project')
        .then(res => res.json())
        .then(data => {
          if (data.projects && data.projects.length > 0) {
            setUserProjectId(data.projects[0].id);
          }
        })
        .catch(err => console.error('Failed to fetch projects:', err));
    }
  }, [session]);

  // Handle suggested question from URL param (from project page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const questionParam = params.get('question');

    if (questionParam && !conversationId) {
      // Auto-start conversation with the suggested question
      startConversationWithQuestion(questionParam);
    }
  }, []);

  // DEV: Load stub data from URL param to skip conversation flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stubConversationId = params.get('stub');

    if (!stubConversationId) return;

    const loadStubData = async () => {
      try {
        console.log('[Stub] Loading conversation:', stubConversationId);
        const response = await fetch(`/api/conversation/${stubConversationId}/stub`);

        if (!response.ok) {
          console.error('[Stub] Failed to load:', response.status);
          return;
        }

        const data = await response.json();
        console.log('[Stub] Loaded data:', {
          conversationId: data.conversationId,
          hasExtractedContext: !!data.extractedContext,
          hasStrategy: !!data.strategy,
        });

        // Hydrate state
        setConversationId(data.conversationId);
        setExperimentVariant(data.experimentVariant || 'baseline-v1');
        setExtractedContext(data.extractedContext);
        setDimensionalCoverage(data.dimensionalCoverage);
        setTraceId(data.traceId);

        // Set guestUserId for registration banner (if conversation belongs to guest)
        if (data.userId) {
          setGuestUserId(data.userId);
        }

        // Jump to extraction view (or strategy if ?stubView=strategy)
        const stubView = params.get('stubView');
        if (stubView === 'strategy' && data.strategy) {
          setStrategy(data.strategy);
          setThoughts(data.thoughts || '');
          setFlowStep('strategy');
        } else {
          setFlowStep('extraction');
        }
        setShowIntro(false);
      } catch (error) {
        console.error('[Stub] Error loading data:', error);
      }
    };

    loadStubData();
  }, []);

  // 90s idle timer for feedback modal
  useEffect(() => {
    if (flowStep !== 'strategy' || !traceId) return;

    let idleTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setShowFeedbackModal(true);
      }, 90000); // 90 seconds
    };

    // Reset timer on any user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer(); // Start initial timer

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [flowStep, traceId]);

  // Session transfer is now handled globally by SessionTransferProvider
  // Hide registration banner when user is authenticated
  useEffect(() => {
    if (session?.user?.id) {
      setShowRegistrationBanner(false);
    }
  }, [session]);

  const handleStartClick = () => {
    startConversation();
  };

  const handleEntryPointSelect = async (option: 'guided' | 'document' | 'canvas' | 'fast-track') => {
    if (option === 'guided') {
      // Start normal conversation flow
      const newConversationId = await startConversation();

      // Log entry point selection after conversation is created
      if (newConversationId) {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: newConversationId,
            eventType: 'entry_point_selected',
            eventData: { option },
          }),
        }).catch(err => console.error('Failed to log event:', err));
      }
    } else if (option === 'document') {
      // Show document upload
      setFlowStep('upload');
      setShowIntro(false);
    } else {
      // Fake doors (canvas or fast-track)
      const fakeDoorConfig = {
        canvas: {
          name: 'Decision Stack Canvas',
          description: 'Build your strategy using a blank Decision Stack template.\n\nThis feature would let you directly fill in Vision, Mission, Objectives, Initiatives, and Principles in a visual canvas interface.',
          eventData: { feature: 'canvas' },
        },
        'fast-track': {
          name: 'Fast Track',
          description: 'Quick multiple choice questions with targeted follow-ups.\n\nThis feature would streamline the conversation with pre-defined options and smart branching.',
          eventData: { feature: 'fast-track' },
        },
      };

      setFakeDoorFeature(fakeDoorConfig[option]);
      setFakeDoorOpen(true);
    }
  };

  const handleFakeDoorInterest = async () => {
    if (!fakeDoorFeature || !conversationId) return;

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        eventType: 'fake_door_click',
        eventData: fakeDoorFeature.eventData,
      }),
    }).catch(err => console.error('Failed to log event:', err));

    console.log(`User interested in: ${fakeDoorFeature.name}`);
  };

  const handleDocumentUploadComplete = async (data: {
    conversationId: string;
    summary: string;
    filename: string;
    experimentVariant?: string;
    guestUserId?: string;
  }) => {
    // Store conversation ID and document data
    setConversationId(data.conversationId);
    setDocumentSummary(data.summary);

    // Set experiment variant from API response
    if (data.experimentVariant) {
      setExperimentVariant(data.experimentVariant);
    }

    // Store guest user ID for session transfer when user authenticates
    if (data.guestUserId) {
      setGuestUserId(data.guestUserId);
      localStorage.setItem('guestUserId', data.guestUserId);
    }

    // Document context will be stored on server, we just need the summary for display
    setFlowStep('document-summary');
  };

  const handleDocumentUploadError = (error: string) => {
    setUploadError(error);
    // Stay on upload screen, show error
  };

  const handleDocumentSummaryContinue = async () => {
    // Move to chat with document context already loaded on server
    setFlowStep('chat');

    // Fetch first message (which will be context-aware based on document)
    try {
      const response = await fetch(`/api/conversation/${conversationId}/messages`);
      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleDocumentSummaryRetry = () => {
    // Go back to upload screen
    setFlowStep('upload');
    setDocumentSummary('');
    setUploadError('');
  };

  const startConversation = async () => {
    return startConversationWithQuestion();
  };

  const startConversationWithQuestion = async (suggestedQuestion?: string) => {
    setIsLoading(true);
    try {
      // Check for variant override in URL query params
      const params = new URLSearchParams(window.location.search);
      const variantOverride = params.get('variant');

      const response = await fetch('/api/conversation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(variantOverride && { variantOverride }),
          ...(suggestedQuestion && { suggestedQuestion }),
        }),
      });

      const data = await response.json();
      setConversationId(data.conversationId);
      setExperimentVariant(data.experimentVariant || 'baseline-v1');

      // Store guest user ID for session transfer when user authenticates
      if (data.guestUserId) {
        setGuestUserId(data.guestUserId);
        localStorage.setItem('guestUserId', data.guestUserId);
      }

      setMessages([{
        id: `msg_${Date.now()}`,
        conversationId: data.conversationId,
        role: 'assistant',
        content: data.message,
        stepNumber: 1,
        timestamp: new Date(),
      }]);

      // Hide intro and show chat interface now that we have the first message
      setShowIntro(false);
      setFlowStep('chat');

      return data.conversationId; // Return conversationId for logging
    } catch (error) {
      console.error('Failed to start conversation:', error);
      return null;
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
        // Add assistant's message
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}`,
          conversationId,
          role: 'assistant',
          content: data.message,
          stepNumber: data.stepNumber,
          timestamp: new Date(),
        }]);

        // Handle early exit offer
        if (data.earlyExitOffered) {
          setEarlyExitOffered(true);
          setSuggestedQuestion(data.suggestedQuestion || null);
        } else {
          setEarlyExitOffered(false);
          setSuggestedQuestion(null);
        }
      }
    } catch (error) {
      console.error('Failed to continue conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractContext = async () => {
    if (!conversationId) return;

    setFlowStep('extracting');
    setIsLoading(true);
    setExtractionStep('starting');
    setExtractionError(undefined);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.status}`);
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (each update is a JSON line)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const update = JSON.parse(line);
            console.log('[Extract] Progress update:', update.step);

            if (update.step === 'complete') {
              // Final result
              const { extractedContext: ctx, dimensionalCoverage: coverage } = update.data;
              console.log('[Extract] Received extraction data:', {
                hasExtractedContext: !!ctx,
                extraction_approach: ctx?.extraction_approach,
                hasCore: 'core' in (ctx || {}),
                hasThemes: 'themes' in (ctx || {}),
                keys: Object.keys(ctx || {}),
                hasDimensionalCoverage: !!coverage,
              });
              setExtractedContext(ctx);
              setDimensionalCoverage(coverage);
              setFlowStep('extraction');
            } else if (update.step === 'error') {
              throw new Error(update.error || 'Extraction failed');
            } else {
              // Progress update
              setExtractionStep(update.step);
            }
          } catch (parseError) {
            console.error('[Extract] Failed to parse progress update:', line, parseError);
          }
        }
      }
    } catch (error) {
      console.error('Failed to extract context:', error);
      setExtractionStep('error');
      setExtractionError(error instanceof Error ? error.message : 'Something went wrong');
      // Reset both flowStep and currentPhase on error so user can continue
      setTimeout(() => {
        setFlowStep('chat');
        setCurrentPhase('QUESTIONING');
      }, 2000); // Give user time to see error
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
        body: JSON.stringify({
          conversationId,
          extractedContext,
          dimensionalCoverage, // [E2] Pass dimensional coverage to generate API
        }),
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

      // Notify sidebar to refresh if user is logged in
      if (session?.user?.id) {
        window.dispatchEvent(new Event('strategySaved'));
      }
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

  // Handle deferral to deep dive
  const handleDeferToDeepDive = (messageContent: string, messageId: string) => {
    // Create a topic from the message content (first 100 chars or until first newline)
    const firstLine = messageContent.split('\n')[0];
    const topic = firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
    setDeferralTopic(topic);
    setDeferralMessageId(messageId);
    setDeepDiveDialogOpen(true);
  };

  // Show variant badge during active conversation flow (for UAT/testing)
  const showVariantBadge = ['chat', 'extracting', 'extraction'].includes(flowStep);

  return (
    <AppLayout experimentVariant={experimentVariant} showVariantBadge={showVariantBadge}>
      <main className="h-full bg-background flex flex-col">
        <div className="container mx-auto py-8 flex-1 flex flex-col min-h-0">
          {showIntro && flowStep === 'intro' && (
            <IntroCard onEntryPointSelect={handleEntryPointSelect} isLoading={isLoading} />
          )}

          {flowStep === 'upload' && (
            <div className="flex-1 flex items-center justify-center">
              <DocumentUpload
                onUploadComplete={handleDocumentUploadComplete}
                onError={handleDocumentUploadError}
              />
              {uploadError && (
                <div className="mt-4 max-w-md mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {uploadError}
                  </p>
                </div>
              )}
            </div>
          )}

          {flowStep === 'document-summary' && documentSummary && (
            <div className="flex-1 flex items-center justify-center">
              <DocumentSummary
                filename={documentContext?.filename || 'your document'}
                summary={documentSummary}
                onContinue={handleDocumentSummaryContinue}
                onRetry={handleDocumentSummaryRetry}
              />
            </div>
          )}

          {!showIntro && flowStep === 'chat' && (
            <div className="flex-1 min-h-0">
              <ChatInterface
                conversationId={conversationId}
                messages={messages}
                onUserResponse={handleUserResponse}
                onEntryPointSelect={handleEntryPointSelect}
                onGenerateStrategy={extractContext}
                onDeferToDeepDive={userProjectId ? handleDeferToDeepDive : undefined}
                isLoading={isLoading}
                isComplete={false}
                currentPhase={currentPhase}
                traceId={traceId}
                earlyExitOffered={earlyExitOffered}
                suggestedQuestion={suggestedQuestion}
              />
            </div>
          )}

          {!showIntro && flowStep === 'extracting' && (
            <ExtractionProgress
              currentStep={extractionStep}
              error={extractionError}
            />
          )}

          {!showIntro && flowStep === 'extraction' && extractedContext && (
            <ExtractionConfirm
              extractedContext={extractedContext}
              onGenerate={handleGenerate}
              onContinue={handleContinue}
              isGenerating={isLoading}
            />
          )}

          {!showIntro && flowStep === 'strategy' && strategy && conversationId && (
            <>
              {showRegistrationBanner && guestUserId && (
                <RegistrationBanner
                  guestUserId={guestUserId}
                  onDismiss={() => setShowRegistrationBanner(false)}
                />
              )}
              <StrategyDisplay
                strategy={strategy}
                thoughts={thoughts}
                conversationId={conversationId}
                traceId={traceId}
              />
              <FeedbackButtons traceId={traceId} />
            </>
          )}

          {showFeedbackModal && traceId && (
            <FeedbackModal
              traceId={traceId}
              onClose={() => setShowFeedbackModal(false)}
            />
          )}

          {fakeDoorFeature && (
            <FakeDoorDialog
              open={fakeDoorOpen}
              onOpenChange={setFakeDoorOpen}
              featureName={fakeDoorFeature.name}
              description={fakeDoorFeature.description}
              onInterest={handleFakeDoorInterest}
            />
          )}

          {/* Deep Dive Deferral Dialog */}
          {userProjectId && (
            <AddDeepDiveDialog
              projectId={userProjectId}
              open={deepDiveDialogOpen}
              onOpenChange={setDeepDiveDialogOpen}
              onCreated={() => {
                // Could show a toast or notification here
                console.log('Deep dive created from deferral');
              }}
              initialTopic={deferralTopic}
              origin="message"
              sourceMessageId={deferralMessageId}
            />
          )}
        </div>
      </main>
    </AppLayout>
  );
}
