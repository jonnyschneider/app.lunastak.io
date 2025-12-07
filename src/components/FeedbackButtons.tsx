'use client';

import { useState } from 'react';
import { UserFeedback } from '@/lib/types';

interface FeedbackButtonsProps {
  traceId: string;
  onFeedback?: (feedback: UserFeedback) => void;
}

export default function FeedbackButtons({ traceId, onFeedback }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<UserFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (selectedFeedback: UserFeedback) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, feedback: selectedFeedback }),
      });

      if (response.ok) {
        setFeedback(selectedFeedback);
        onFeedback?.(selectedFeedback);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (feedback) {
    return (
      <div className="text-center py-4 text-gray-600">
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="flex gap-4 justify-center py-6">
      <button
        onClick={() => handleFeedback('helpful')}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <span className="text-2xl">👍</span>
        <span>This is helpful</span>
      </button>
      <button
        onClick={() => handleFeedback('not_helpful')}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <span className="text-2xl">👎</span>
        <span>Not quite right</span>
      </button>
    </div>
  );
}
