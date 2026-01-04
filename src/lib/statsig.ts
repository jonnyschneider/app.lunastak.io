import Statsig from 'statsig-node';

let statsigInitialized = false;

export async function initializeStatsig() {
  if (!statsigInitialized && process.env.STATSIG_SERVER_SECRET_KEY) {
    try {
      console.log('[Statsig] Initializing with environment:', process.env.NODE_ENV || 'development');
      await Statsig.initialize(process.env.STATSIG_SERVER_SECRET_KEY, {
        environment: { tier: process.env.NODE_ENV || 'development' },
      });
      statsigInitialized = true;
      console.log('[Statsig] Successfully initialized');
    } catch (error) {
      console.error('[Statsig] Initialization error:', error);
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

  if (!process.env.STATSIG_SERVER_SECRET_KEY) {
    console.log('[Statsig] No STATSIG_SERVER_SECRET_KEY found, returning baseline');
    // Fallback to baseline if Statsig not configured
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

  if (!process.env.STATSIG_SERVER_SECRET_KEY) {
    console.log('[Statsig] No STATSIG_SERVER_SECRET_KEY found, returning baseline');
    return 'baseline-v1';
  }

  // Get variant from Statsig experiment
  // Experiment should be configured in Statsig console with:
  // - Control: emergent-extraction-e1a (E2)
  // - Test: dimension-guided-e3 (E3)
  // - Parameter: "variant" (string)
  const experiment = Statsig.getExperiment({ userID: userId }, QUESTIONING_EXPERIMENT);
  const variant = experiment.get('variant', 'emergent-extraction-e1a') as string;

  console.log(`[Statsig] Experiment: userId=${userId}, experiment=${QUESTIONING_EXPERIMENT}, variant=${variant}`);

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
