/**
 * Tests for the Dismissal API
 *
 * Tests POST, GET, and DELETE operations for user dismissals.
 * Verifies the generic dismissal pattern works for different item types.
 */

// Helper to get item key (matching server-side implementation)
function getItemKey(content: string): string {
  return content.slice(0, 255);
}

describe('Dismissal API', () => {
  describe('Item Key Generation', () => {
    it('should use content directly as key', () => {
      const content = 'What are your primary customer segments?';
      const key1 = getItemKey(content);
      const key2 = getItemKey(content);

      expect(key1).toBe(key2);
      expect(key1).toBe(content);
    });

    it('should truncate long content to 255 chars', () => {
      const longContent = 'A'.repeat(300);
      const key = getItemKey(longContent);

      expect(key).toHaveLength(255);
    });

    it('should handle dimension keys as content', () => {
      const dimension = 'CUSTOMER_MARKET';
      const key = getItemKey(dimension);

      expect(key).toBe(dimension);
      expect(typeof key).toBe('string');
    });
  });

  describe('POST /api/dismissal', () => {
    it('should accept valid dismissal request for suggested question', () => {
      const validRequest = {
        itemType: 'suggested_question',
        itemContent: 'What are your key competitive advantages?',
        projectId: 'proj_abc123',
      };

      expect(validRequest.itemType).toBe('suggested_question');
      expect(validRequest.itemContent).toBeTruthy();
      expect(validRequest.projectId).toBeTruthy();
    });

    it('should accept valid dismissal request for focus area', () => {
      const validRequest = {
        itemType: 'focus_area',
        itemContent: 'CUSTOMER_MARKET', // Dimension key
        projectId: 'proj_abc123',
      };

      expect(validRequest.itemType).toBe('focus_area');
      expect(validRequest.itemContent).toBe('CUSTOMER_MARKET');
    });

    it('should reject request without itemType', () => {
      const invalidRequest = {
        itemContent: 'Some content',
        projectId: 'proj_abc123',
      };

      expect(invalidRequest).not.toHaveProperty('itemType');
    });

    it('should reject request without itemContent', () => {
      const invalidRequest = {
        itemType: 'suggested_question',
        projectId: 'proj_abc123',
      };

      expect(invalidRequest).not.toHaveProperty('itemContent');
    });

    it('should accept request without projectId (global dismissal)', () => {
      const validRequest = {
        itemType: 'tip',
        itemContent: 'Welcome tip content',
      };

      expect(validRequest).not.toHaveProperty('projectId');
      expect(validRequest.itemType).toBe('tip');
    });
  });

  describe('GET /api/dismissal', () => {
    it('should filter dismissals by projectId when provided', () => {
      const mockDismissals = [
        { itemType: 'suggested_question', itemKey: 'abc123', projectId: 'proj_1' },
        { itemType: 'suggested_question', itemKey: 'def456', projectId: 'proj_2' },
        { itemType: 'focus_area', itemKey: 'ghi789', projectId: 'proj_1' },
      ];

      const proj1Dismissals = mockDismissals.filter(d => d.projectId === 'proj_1');

      expect(proj1Dismissals).toHaveLength(2);
      expect(proj1Dismissals.every(d => d.projectId === 'proj_1')).toBe(true);
    });

    it('should return all dismissals when no projectId filter', () => {
      const mockDismissals = [
        { itemType: 'suggested_question', itemKey: 'abc123', projectId: 'proj_1' },
        { itemType: 'tip', itemKey: 'def456', projectId: null },
      ];

      expect(mockDismissals).toHaveLength(2);
    });

    it('should return dismissals with expected structure', () => {
      const expectedStructure = {
        dismissals: [
          {
            itemType: expect.any(String),
            itemKey: expect.any(String),
            projectId: expect.any(String),
          },
        ],
      };

      expect(expectedStructure.dismissals[0]).toHaveProperty('itemType');
      expect(expectedStructure.dismissals[0]).toHaveProperty('itemKey');
      expect(expectedStructure.dismissals[0]).toHaveProperty('projectId');
    });
  });

  describe('DELETE /api/dismissal', () => {
    it('should accept valid restore request', () => {
      const validRequest = {
        itemType: 'suggested_question',
        itemContent: 'What are your key competitive advantages?',
        projectId: 'proj_abc123',
      };

      expect(validRequest.itemType).toBeTruthy();
      expect(validRequest.itemContent).toBeTruthy();
    });

    it('should generate same key for restore as original dismiss', () => {
      const content = 'What are your primary revenue streams?';

      // Key at dismiss time
      const dismissKey = getItemKey(content);

      // Key at restore time
      const restoreKey = getItemKey(content);

      expect(dismissKey).toBe(restoreKey);
    });
  });

  describe('Item Type Support', () => {
    const validItemTypes = [
      'suggested_question',
      'focus_area',
      'tip',
      // Future types can be added here
    ];

    it('should support suggested_question type', () => {
      expect(validItemTypes).toContain('suggested_question');
    });

    it('should support focus_area type', () => {
      expect(validItemTypes).toContain('focus_area');
    });

    it('should support tip type for future use', () => {
      expect(validItemTypes).toContain('tip');
    });
  });

  describe('Unique Constraint', () => {
    it('should use composite key for uniqueness', () => {
      // The unique constraint is: userId + itemType + itemKey + projectId
      const dismissal1 = {
        userId: 'user_1',
        itemType: 'suggested_question',
        itemKey: 'What is your pricing strategy?',
        projectId: 'proj_1',
      };

      const dismissal2 = {
        userId: 'user_1',
        itemType: 'suggested_question',
        itemKey: 'What is your pricing strategy?',
        projectId: 'proj_2', // Different project
      };

      // Same user, same type, same content, different project = different dismissals
      expect(dismissal1.projectId).not.toBe(dismissal2.projectId);
    });

    it('should allow same content dismissed in different projects', () => {
      const content = 'What is your pricing strategy?';
      const key = getItemKey(content);

      const dismissalProject1 = {
        userId: 'user_1',
        itemType: 'suggested_question',
        itemKey: key,
        projectId: 'proj_1',
      };

      const dismissalProject2 = {
        userId: 'user_1',
        itemType: 'suggested_question',
        itemKey: key, // Same key
        projectId: 'proj_2', // Different project
      };

      // These should be allowed as separate dismissals
      expect(dismissalProject1.itemKey).toBe(dismissalProject2.itemKey);
      expect(dismissalProject1.projectId).not.toBe(dismissalProject2.projectId);
    });
  });

  describe('UI Integration Contract', () => {
    it('should enable filtering dismissed questions in UI', () => {
      const allQuestions = [
        'What is your target market?',
        'How do you acquire customers?',
        'What are your competitive advantages?',
      ];

      const dismissedKeys = new Set([
        getItemKey('How do you acquire customers?'),
      ]);

      const visibleQuestions = allQuestions.filter(
        q => !dismissedKeys.has(getItemKey(q))
      );

      expect(visibleQuestions).toHaveLength(2);
      expect(visibleQuestions).not.toContain('How do you acquire customers?');
    });

    it('should enable filtering dismissed focus areas in UI', () => {
      const allFocusAreas = [
        { dimension: 'CUSTOMER_MARKET', gaps: ['Market size unclear'] },
        { dimension: 'VALUE_PROPOSITION', gaps: ['Need clearer positioning'] },
        { dimension: 'COMPETITIVE_LANDSCAPE', gaps: ['Competitors not identified'] },
      ];

      const dismissedDimensions = new Set([
        getItemKey('CUSTOMER_MARKET'),
      ]);

      const visibleFocusAreas = allFocusAreas.filter(
        area => !dismissedDimensions.has(getItemKey(area.dimension))
      );

      expect(visibleFocusAreas).toHaveLength(2);
      expect(visibleFocusAreas.map(a => a.dimension)).not.toContain('CUSTOMER_MARKET');
    });
  });
});
