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
        <div className="bg-muted border border-border rounded-lg p-4 text-center">
          <p className="text-foreground text-sm">
            Thanks for your feedback! Rated as: <span className="font-semibold capitalize">{rating}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-foreground mb-2 text-center">
          How would you rate this strategy?
        </h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Help us improve by rating the quality of the generated strategy
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleRating('bad')}
            disabled={isSubmitting}
            className="px-8 py-3 border-2 border-border text-foreground rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Not Good'}
          </button>
          <button
            onClick={() => handleRating('good')}
            disabled={isSubmitting}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Good'}
          </button>
        </div>
      </div>
    </div>
  );
}
