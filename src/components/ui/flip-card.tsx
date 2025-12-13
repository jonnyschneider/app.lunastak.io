'use client';

import { useState } from 'react';
import clsx from 'clsx';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}

export function FlipCard({ front, back, className }: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className={clsx('flip-card-container', className)}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={handleFlip}
    >
      <div
        className={clsx(
          'flip-card-inner',
          'relative w-full h-full transition-transform duration-600 ease-in-out',
          '[transform-style:preserve-3d]',
          isFlipped && '[transform:rotateY(180deg)]'
        )}
      >
        {/* Front Face */}
        <div
          className={clsx(
            'flip-card-front',
            'absolute inset-0 w-full h-full',
            '[backface-visibility:hidden]'
          )}
        >
          {front}
        </div>

        {/* Back Face */}
        <div
          className={clsx(
            'flip-card-back',
            'absolute inset-0 w-full h-full',
            '[backface-visibility:hidden]',
            '[transform:rotateY(180deg)]'
          )}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
