import { migrateToOMTM, isOMTMObjective, isSimplifiedOMTM, hasLegacyPrimaryMetric } from '../objective-omtm-migration';

describe('objective-omtm-migration', () => {
  describe('detection functions', () => {
    it('should detect simplified OMTM with omtm field', () => {
      const simplified = {
        id: '1',
        title: 'Increase retention',
        explanation: 'Retention drives growth',
        omtm: 'Weekly Active Users',
        aspiration: '40% increase',
      };
      expect(isSimplifiedOMTM(simplified)).toBe(true);
      expect(isOMTMObjective(simplified)).toBe(true);
    });

    it('should detect legacy OMTM with primaryMetric', () => {
      const legacy = {
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
      expect(hasLegacyPrimaryMetric(legacy)).toBe(true);
      expect(isOMTMObjective(legacy)).toBe(true);
      expect(isSimplifiedOMTM(legacy)).toBe(false);
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
  });

  describe('migration to simplified OMTM', () => {
    it('should migrate KR-based objective to simplified OMTM', () => {
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
      expect(migrated.omtm).toBe('Weekly Active Users');
      expect(migrated.aspiration).toBe('12% → 40%');
    });

    it('should migrate legacy primaryMetric to simplified OMTM', () => {
      const legacy = {
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
      const migrated = migrateToOMTM(legacy);

      expect(migrated.omtm).toBe('Weekly Active Users');
      expect(migrated.aspiration).toBe('12% → 40%');
      // Should preserve primaryMetric for backward compat
      expect(migrated.primaryMetric).toEqual(legacy.primaryMetric);
    });

    it('should migrate legacy metric objective to simplified OMTM', () => {
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
      expect(migrated.omtm).toBe('Revenue');
      expect(migrated.aspiration).toBe('25%');
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

      expect(migrated.omtm).toBe('Day 1 Activation');
      expect(migrated.aspiration).toBe('30% → 60%');
      expect(migrated.supportingMetrics).toContain('Support tickets');
    });

    it('should pass through already-simplified OMTM objectives unchanged', () => {
      const simplified = {
        id: '1',
        title: 'Increase retention',
        explanation: 'Retention drives growth',
        omtm: 'Weekly Active Users',
        aspiration: 'Significant growth',
      };
      const migrated = migrateToOMTM(simplified);
      expect(migrated).toEqual(simplified);
    });

    it('should handle target-only aspiration with direction arrow', () => {
      const krBased = {
        id: '1',
        title: 'Reduce churn',
        objective: 'Reduce customer churn',
        keyResults: [{
          id: 'kr-1',
          belief: { action: 'improving support', outcome: 'reduce churn' },
          signal: 'Monthly churn rate',
          baseline: '',
          target: '2%',
          timeframe: '6M' as const,
        }],
        explanation: 'Churn is costly',
      };
      const migrated = migrateToOMTM(krBased);

      expect(migrated.omtm).toBe('Monthly churn rate');
      expect(migrated.aspiration).toBe('↓ 2%');
    });
  });
});
