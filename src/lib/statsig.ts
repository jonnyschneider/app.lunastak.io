import Statsig from 'statsig-node';

let statsigInitialized = false;
let statsigInitFailed = false;

// Get environment tier for Statsig
// VERCEL_ENV: 'production' | 'preview' | 'development' (Vercel-specific)
// Falls back to NODE_ENV for local development
function getEnvironmentTier(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
}

// Helper to add timeout to a promise
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timeout]);
}

export async function initializeStatsig() {
  if (!statsigInitialized && process.env.STATSIG_SERVER_SECRET_KEY) {
    try {
      const tier = getEnvironmentTier();
      console.log('[Statsig] Initializing with environment:', tier);

      // Add 5 second timeout to prevent blocking
      await withTimeout(
        Statsig.initialize(process.env.STATSIG_SERVER_SECRET_KEY, {
          environment: { tier },
        }),
        5000,
        'Statsig initialization timed out after 5s'
      );

      statsigInitialized = true;
      console.log('[Statsig] Successfully initialized');
    } catch (error) {
      console.error('[Statsig] Initialization error:', error);
      // Mark as initialized anyway to prevent repeated attempts
      statsigInitialized = true;
      statsigInitFailed = true;
    }
  } else if (!process.env.STATSIG_SERVER_SECRET_KEY) {
    console.log('[Statsig] No server secret key found in environment');
  }
}

export async function checkFeatureGate(
  userId: string,
  gateName: string
): Promise<boolean> {
  await initializeStatsig();

  if (!process.env.STATSIG_SERVER_SECRET_KEY || statsigInitFailed) {
    console.log('[Statsig] Not available (no key or init failed), returning baseline');
    // Fallback to baseline if Statsig not configured or failed to initialize
    return false;
  }

  const result = Statsig.checkGate({ userID: userId }, gateName);
  console.log(`[Statsig] Gate check: userId=${userId}, gate=${gateName}, result=${result}`);

  return result;
}

// Experiment name in Statsig console
const QUESTIONING_EXPERIMENT = 'questioning_approach';

// Valid variants for the questioning approach experiment
const VALID_VARIANTS = ['baseline-v1', 'emergent-extraction-e1a', 'dimension-guided-e3'] as const;
type ExperimentVariant = typeof VALID_VARIANTS[number];

export async function getExperimentVariant(
  userId: string,
  variantOverride?: string
): Promise<string> {
  // Allow manual override via query parameter for testing/UAT
  if (variantOverride) {
    if (VALID_VARIANTS.includes(variantOverride as ExperimentVariant)) {
      console.log(`[Statsig] Using variant override: ${variantOverride}`);
      return variantOverride;
    }
    console.warn(`[Statsig] Invalid variant override: ${variantOverride}, ignoring`);
  }

  await initializeStatsig();

  if (!process.env.STATSIG_SERVER_SECRET_KEY || statsigInitFailed) {
    console.log('[Statsig] Not available (no key or init failed), returning default variant');
    return 'emergent-extraction-e1a';
  }

  // Get variant from Statsig experiment
  // Experiment should be configured in Statsig console with:
  // - Control: emergent-extraction-e1a (E2)
  // - Test: dimension-guided-e3 (E3)
  // - Parameter: "variant" (string)
  const experiment = Statsig.getExperiment({ userID: userId }, QUESTIONING_EXPERIMENT);
  const rawVariant = experiment.get('variant', 'emergent-extraction-e1a') as string;

  // Normalize: convert underscores to hyphens for consistency
  const variant = rawVariant.replace(/_/g, '-');

  // Debug: log experiment details
  console.log(`[Statsig] Experiment lookup:`, {
    userId,
    experiment: QUESTIONING_EXPERIMENT,
    rawVariant,
    variant,
    experimentValue: experiment.value,
    ruleID: experiment.getRuleID?.() || 'N/A',
  });

  // Validate variant is known
  if (!VALID_VARIANTS.includes(variant as ExperimentVariant)) {
    console.warn(`[Statsig] Unknown variant "${variant}", falling back to emergent-extraction-e1a`);
    return 'emergent-extraction-e1a';
  }

  return variant;
}

export function shutdownStatsig() {
  if (statsigInitialized) {
    Statsig.shutdown();
    statsigInitialized = false;
  }
}

/**
 * Log a custom event to Statsig for experiment metrics
 * Use for key conversion events like strategy_generated, quality_rating, etc.
 */
export async function logStatsigEvent(
  userId: string,
  eventName: string,
  value?: number,
  metadata?: Record<string, string>
) {
  await initializeStatsig();

  if (!process.env.STATSIG_SERVER_SECRET_KEY || statsigInitFailed) {
    return;
  }

  Statsig.logEvent({ userID: userId }, eventName, value, metadata);
  console.log(`[Statsig] Event logged: ${eventName}`, { userId, value, metadata });

  // Flush immediately in serverless environment to ensure events are sent
  await Statsig.flush();
  console.log(`[Statsig] Events flushed`);
}
