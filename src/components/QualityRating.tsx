'use client';

import { useState } from 'react';

interface QualityRatingProps {
  traceId: string;
}

export default function QualityRating({ traceId }: QualityRatingProps) {
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRating = async (value: 'good' | 'bad') => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/quality-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, rating: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      setRating(value);
    } catch (error) {
      console.error('Failed to submit quality rating:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rating) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 text-center">
          <p className="text-zinc-700 dark:text-zinc-300 text-sm">
            Thanks for your feedback! Rated as: <span className="font-semibold capitalize">{rating}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2 text-center">
          How would you rate this strategy?
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 text-center">
          Help us improve by rating the quality of the generated strategy
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleRating('bad')}
            disabled={isSubmitting}
            className="px-8 py-3 border-2 border-red-500 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Not Good'}
          </button>
          <button
            onClick={() => handleRating('good')}
            disabled={isSubmitting}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Good'}
          </button>
        </div>
      </div>
    </div>
  );
}
