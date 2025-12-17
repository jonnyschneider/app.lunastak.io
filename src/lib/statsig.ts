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

export async function getExperimentVariant(userId: string): Promise<string> {
  const isEmergentEnabled = await checkFeatureGate(userId, 'emergent_extraction_e1a');
  return isEmergentEnabled ? 'emergent-extraction-e1a' : 'baseline-v1';
}

export function shutdownStatsig() {
  if (statsigInitialized) {
    Statsig.shutdown();
    statsigInitialized = false;
  }
}
