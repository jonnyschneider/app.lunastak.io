import Statsig from 'statsig-node';

let statsigInitialized = false;

export async function initializeStatsig() {
  if (!statsigInitialized && process.env.STATSIG_SERVER_SECRET_KEY) {
    await Statsig.initialize(process.env.STATSIG_SERVER_SECRET_KEY, {
      environment: { tier: process.env.NODE_ENV || 'development' },
    });
    statsigInitialized = true;
  }
}

export async function checkFeatureGate(
  userId: string,
  gateName: string
): Promise<boolean> {
  await initializeStatsig();

  if (!process.env.STATSIG_SERVER_SECRET_KEY) {
    // Fallback to baseline if Statsig not configured
    return false;
  }

  return Statsig.checkGate({ userID: userId }, gateName);
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
