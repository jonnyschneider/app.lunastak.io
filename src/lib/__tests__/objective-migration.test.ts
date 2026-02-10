import { migrateObjectiveToOKR, isLegacyObjective } from '../objective-migration';

describe('objective-migration', () => {
  it('should detect legacy objective with metric field and no keyResults', () => {
    const legacy = {
      id: '1',
      pithy: 'Grow revenue',
      metric: { summary: '25%', full: 'Increase by 25%', category: 'Revenue', direction: 'increase' as const, timeframe: '6M' as const },
      explanation: 'Growth matters',
      successCriteria: 'Hit target',
    };
    expect(isLegacyObjective(legacy)).toBe(true);
  });

  it('should not detect new objective with keyResults as legacy', () => {
    const newObj = {
      id: '1',
      objective: 'Grow revenue',
      keyResults: [{
        id: 'kr-1',
        belief: { action: 'expanding sales', outcome: 'revenue growth' },
        signal: 'MRR',
        baseline: '$100k',
        target: '$125k',
        timeframe: '6M' as const,
      }],
      explanation: 'Growth matters',
    };
    expect(isLegacyObjective(newObj)).toBe(false);
  });

  it('should migrate legacy objective to OKR format', () => {
    const legacy = {
      id: '1',
      pithy: 'Grow revenue significantly',
      metric: { summary: '25%', full: 'Increase revenue by 25%', category: 'Revenue', direction: 'increase' as const, timeframe: '6M' as const },
      explanation: 'Growth matters',
      successCriteria: 'Hit target',
    };
    const migrated = migrateObjectiveToOKR(legacy);

    expect(migrated.objective).toBe('Grow revenue significantly');
    expect(migrated.keyResults).toHaveLength(1);
    expect(migrated.keyResults![0].target).toBe('25%');
    expect(migrated.keyResults![0].timeframe).toBe('6M');
    expect(migrated.keyResults![0].signal).toBe('Revenue');
  });

  it('should preserve id and explanation when migrating', () => {
    const legacy = {
      id: 'obj-123',
      pithy: 'Test objective',
      metric: { summary: '50%', full: 'Achieve 50% improvement', category: 'Quality' },
      explanation: 'This is important',
      successCriteria: 'Done when achieved',
    };
    const migrated = migrateObjectiveToOKR(legacy);

    expect(migrated.id).toBe('obj-123');
    expect(migrated.explanation).toBe('This is important');
    expect(migrated.successCriteria).toBe('Done when achieved');
  });

  it('should handle missing timeframe with default', () => {
    const legacy = {
      id: '1',
      pithy: 'No timeframe',
      metric: { summary: '10%', full: 'Increase by 10%', category: 'Growth' },
      explanation: 'Test',
    };
    const migrated = migrateObjectiveToOKR(legacy);

    expect(migrated.keyResults![0].timeframe).toBe('6M');
  });

  it('should handle objective field instead of pithy', () => {
    const legacy = {
      id: '1',
      objective: 'Already has objective field',
      pithy: 'Old pithy value',
      metric: { summary: '20%', full: 'Achieve 20%', category: 'Test' },
      explanation: 'Test',
    };
    const migrated = migrateObjectiveToOKR(legacy);

    expect(migrated.objective).toBe('Already has objective field');
  });
});
