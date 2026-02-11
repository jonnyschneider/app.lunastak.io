import { loadDemoFixture, transformFixtureForUser } from '@/lib/seed-demo';

describe('seedDemoProject', () => {
  describe('loadDemoFixture', () => {
    it('should load the complete-buildflow fixture', async () => {
      const fixture = await loadDemoFixture();
      expect(fixture).toBeDefined();
      expect(fixture.template.name).toBe('complete-buildflow-demo');
      expect(fixture.projects.length).toBeGreaterThan(0);
    });
  });

  describe('transformFixtureForUser', () => {
    it('should replace user ID and generate new project IDs', async () => {
      const fixture = await loadDemoFixture();
      const userId = 'user_test123';

      const transformed = transformFixtureForUser(fixture, userId);

      expect(transformed.userId).toBe(userId);
      expect(transformed.projects[0].userId).toBe(userId);
      expect(transformed.projects[0].isDemo).toBe(true);
      expect(transformed.projects[0].name).toBe('Demo: BuildFlow Strategy');
      // IDs should be new CUIDs, not template placeholders
      expect(transformed.projects[0].id).not.toContain('{{');
    });

    it('should generate unique IDs for each call', async () => {
      const fixture = await loadDemoFixture();
      const userId = 'user_test123';

      const first = transformFixtureForUser(fixture, userId);
      const second = transformFixtureForUser(fixture, userId);

      expect(first.projects[0].id).not.toBe(second.projects[0].id);
    });
  });
});
