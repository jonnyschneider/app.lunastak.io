'use client';

import { useEffect, useState } from 'react';
import { StatsigClient } from '@statsig/js-client';
import { runStatsigSessionReplay } from '@statsig/session-replay';
import { runStatsigAutoCapture } from '@statsig/web-analytics';
import packageJson from '../../package.json';

let statsigClient: StatsigClient | null = null;

export function StatsigProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY;

    if (!clientKey) {
      console.log('[Statsig Client] No client key found, skipping initialization');
      setInitialized(true);
      return;
    }

    if (statsigClient) {
      setInitialized(true);
      return;
    }

    const initStatsig = async () => {
      try {
        const tier = process.env.NEXT_PUBLIC_VERCEL_ENV || 'development';
        console.log(`[Statsig Client] Initializing (tier: ${tier}) with autocapture...`);

        statsigClient = new StatsigClient(clientKey, {
          custom: { app_version: packageJson.version },
        }, {
          environment: { tier },
        });

        // Enable session replay
        runStatsigSessionReplay(statsigClient);

        // Enable web analytics autocapture
        runStatsigAutoCapture(statsigClient);

        await statsigClient.initializeAsync();

        console.log('[Statsig Client] Successfully initialized with autocapture');
        setInitialized(true);
      } catch (error) {
        console.error('[Statsig Client] Initialization error:', error);
        setInitialized(true); // Still render children on error
      }
    };

    initStatsig();

    return () => {
      if (statsigClient) {
        statsigClient.shutdown();
        statsigClient = null;
      }
    };
  }, []);

  // Always render children - Statsig init is non-blocking
  return <>{children}</>;
}

// Export client for manual event logging if needed
export function getStatsigClient(): StatsigClient | null {
  return statsigClient;
}
