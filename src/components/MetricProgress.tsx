'use client';

import { PrimaryMetric } from '@/lib/types';

interface MetricProgressProps {
  metric: PrimaryMetric;
  size?: 'sm' | 'md' | 'lg';
}

export function MetricProgress({ metric, size = 'md' }: MetricProgressProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const arrowSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`font-medium text-foreground ${sizeClasses[size]}`}>
          {metric.name}
        </span>
        <span className={`text-muted-foreground ${sizeClasses[size]}`}>
          {metric.timeframe}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-muted-foreground ${sizeClasses[size]}`}>
          {metric.baseline || '?'}
        </span>
        <div className="flex-1 h-1 bg-muted rounded-full relative">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full"
            style={{ width: '0%' }}
          />
          <span className={`absolute -right-1 -top-1 ${arrowSizeClasses[size]}`}>
            {metric.direction === 'increase' ? '↑' : '↓'}
          </span>
        </div>
        <span className={`font-semibold text-foreground ${sizeClasses[size]}`}>
          {metric.target}
        </span>
      </div>
    </div>
  );
}
