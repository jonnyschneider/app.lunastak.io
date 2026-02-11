import { migrateToOMTM, isOMTMObjective } from '../objective-omtm-migration';

describe('objective-omtm-migration', () => {
  it('should detect OMTM objective with primaryMetric', () => {
    const omtm = {
      id: '1',
      title: 'Increase retention',
      explanation: 'Retention drives growth',
      primaryMetric: {
        name: 'Weekly Active Users',
        baseline: '12%',
        target: '40%',
        timeframe: '6M' as const,
        direction: 'increase' as const,
      },
    };
    expect(isOMTMObjective(omtm)).toBe(true);
  });

  it('should not detect KR-based objective as OMTM', () => {
    const krBased = {
      id: '1',
      objective: 'Increase retention',
      keyResults: [{
        id: 'kr-1',
        belief: { action: 'improving onboarding', outcome: 'increase retention' },
        signal: 'WAU',
        baseline: '12%',
        target: '40%',
        timeframe: '6M' as const,
      }],
      explanation: 'Retention drives growth',
    };
    expect(isOMTMObjective(krBased)).toBe(false);
  });

  it('should migrate KR-based objective to OMTM format', () => {
    const krBased = {
      id: '1',
      title: 'Increase retention',
      objective: 'Increase retention significantly',
      keyResults: [{
        id: 'kr-1',
        belief: { action: 'improving onboarding', outcome: 'increase retention' },
        signal: 'Weekly Active Users',
        baseline: '12%',
        target: '40%',
        timeframe: '6M' as const,
      }],
      explanation: 'Retention drives growth',
    };
    const migrated = migrateToOMTM(krBased);

    expect(migrated.title).toBe('Increase retention');
    expect(migrated.primaryMetric?.name).toBe('Weekly Active Users');
    expect(migrated.primaryMetric?.baseline).toBe('12%');
    expect(migrated.primaryMetric?.target).toBe('40%');
    expect(migrated.primaryMetric?.timeframe).toBe('6M');
    expect(migrated.primaryMetric?.direction).toBe('increase');
  });

  it('should migrate legacy metric objective to OMTM format', () => {
    const legacy = {
      id: '1',
      pithy: 'Grow revenue',
      metric: {
        summary: '25%',
        full: 'Increase by 25%',
        category: 'Revenue',
        direction: 'increase' as const,
        timeframe: '6M' as const,
      },
      explanation: 'Growth matters',
    };
    const migrated = migrateToOMTM(legacy);

    expect(migrated.title).toBe('Grow revenue');
    expect(migrated.primaryMetric?.name).toBe('Revenue');
    expect(migrated.primaryMetric?.target).toBe('25%');
    expect(migrated.primaryMetric?.direction).toBe('increase');
  });

  it('should extract supporting metrics from additional KRs', () => {
    const multiKR = {
      id: '1',
      title: 'Improve activation',
      objective: 'Improve activation funnel',
      keyResults: [
        {
          id: 'kr-1',
          belief: { action: 'simplifying onboarding', outcome: 'increase activation' },
          signal: 'Day 1 Activation',
          baseline: '30%',
          target: '60%',
          timeframe: '6M' as const,
        },
        {
          id: 'kr-2',
          belief: { action: 'adding tooltips', outcome: 'reduce confusion' },
          signal: 'Support tickets',
          baseline: '100/week',
          target: '50/week',
          timeframe: '6M' as const,
        },
      ],
      explanation: 'Activation is key',
    };
    const migrated = migrateToOMTM(multiKR);

    expect(migrated.primaryMetric?.name).toBe('Day 1 Activation');
    expect(migrated.supportingMetrics).toContain('Support tickets');
  });

  it('should pass through already-OMTM objectives unchanged', () => {
    const omtm = {
      id: '1',
      title: 'Increase retention',
      explanation: 'Retention drives growth',
      primaryMetric: {
        name: 'Weekly Active Users',
        baseline: '12%',
        target: '40%',
        timeframe: '6M' as const,
        direction: 'increase' as const,
      },
    };
    const migrated = migrateToOMTM(omtm);
    expect(migrated).toEqual(omtm);
  });
});
