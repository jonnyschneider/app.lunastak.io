'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { StatsigClient } from '@statsig/js-client';
import { runStatsigSessionReplay } from '@statsig/session-replay';
import { runStatsigAutoCapture } from '@statsig/web-analytics';
import packageJson from '../../package.json';

let statsigClient: StatsigClient | null = null;

type UserType = 'guest' | 'signed_up' | 'unknown';
let currentUserType: UserType = 'unknown';

function deriveUserType(email: string | null | undefined): UserType {
  if (!email) return 'unknown';
  return email.endsWith('@guest.lunastak.io') ? 'guest' : 'signed_up';
}

export function StatsigProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const { data: session, status } = useSession();

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

  // Sync userType — guests don't have a NextAuth session, so resolve via /api/me
  useEffect(() => {
    if (status === 'loading') return;

    const applyIdentity = (userId: string | null, userType: UserType, email?: string) => {
      currentUserType = userType;
      if (statsigClient) {
        statsigClient.updateUserAsync({
          userID: userId ?? undefined,
          email,
          custom: { app_version: packageJson.version, userType },
        }).catch(() => {});
      }
    };

    if (session?.user?.email) {
      applyIdentity(session.user.id ?? null, deriveUserType(session.user.email), session.user.email);
      return;
    }

    fetch('/api/user/account')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        applyIdentity(data.userId ?? null, data.userType ?? 'unknown', data.email);
      })
      .catch(() => {});
  }, [session?.user?.id, session?.user?.email, status]);

  // Always render children - Statsig init is non-blocking
  return <>{children}</>;
}

// Export client for manual event logging if needed
export function getStatsigClient(): StatsigClient | null {
  return statsigClient;
}

/**
 * Log an event and immediately flush to ensure delivery.
 * Auto-attaches userType (guest | signed_up | unknown) to metadata.
 */
export function logAndFlush(
  eventName: string,
  value?: string | number,
  metadata?: Record<string, string>
) {
  if (!statsigClient) return;
  const meta = { userType: currentUserType, ...(metadata || {}) };
  statsigClient.logEvent(eventName, value, meta);
  statsigClient.flush();
}
