import { Objective, Initiative, Principle } from './types';

export function generatePlaceholderInitiatives(objectives: Objective[]): Initiative[] {
  if (objectives.length === 0) {
    return [];
  }

  const objectiveIds = objectives.map(obj => obj.id);

  // Helper to get random subset of objective IDs
  const getRandomObjectives = (): string[] => {
    const count = Math.floor(Math.random() * 2) + 1; // 1-2 objectives per initiative
    const shuffled = [...objectiveIds].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  return [
    {
      id: 'init-1',
      title: 'Launch MVP Product',
      description: 'Develop and release minimum viable product to test market fit and gather user feedback.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-2',
      title: 'Build Marketing Campaign',
      description: 'Create comprehensive marketing strategy targeting key customer segments.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-3',
      title: 'Establish Sales Process',
      description: 'Define and implement repeatable sales methodology with clear qualification criteria.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-4',
      title: 'Develop Partnership Strategy',
      description: 'Identify and engage strategic partners to expand market reach and capabilities.',
      objectiveIds: getRandomObjectives(),
    },
    {
      id: 'init-5',
      title: 'Optimize Customer Onboarding',
      description: 'Streamline new customer experience to reduce time-to-value and increase retention.',
      objectiveIds: getRandomObjectives(),
    },
  ];
}

export function generatePlaceholderPrinciples(): Principle[] {
  return [
    {
      id: 'prin-1',
      title: 'Customer First',
      description: 'Every decision prioritizes long-term customer value over short-term gains.',
    },
    {
      id: 'prin-2',
      title: 'Data-Driven Decisions',
      description: 'Base strategic choices on quantitative evidence and validated learning.',
    },
    {
      id: 'prin-3',
      title: 'Iterate Rapidly',
      description: 'Test assumptions quickly, learn fast, and adapt based on feedback.',
    },
    {
      id: 'prin-4',
      title: 'Quality Over Speed',
      description: 'Build sustainable solutions that scale rather than quick fixes.',
    },
    {
      id: 'prin-5',
      title: 'Transparent Communication',
      description: 'Share information openly with stakeholders to build trust and alignment.',
    },
    {
      id: 'prin-6',
      title: 'Sustainable Growth',
      description: 'Focus on profitable, repeatable growth models rather than unsustainable expansion.',
    },
    {
      id: 'prin-7',
      title: 'Team Empowerment',
      description: 'Give teams autonomy and ownership to drive innovation and accountability.',
    },
    {
      id: 'prin-8',
      title: 'Continuous Improvement',
      description: 'Regularly review and refine processes, products, and strategies.',
    },
  ];
}

/**
 * Parse objective text to extract metrics and timeframes
 */
function parseObjectiveText(text: string): {
  cleanText: string;
  metricValue?: string;
  timeframe?: '3M' | '6M' | '9M' | '12M' | '18M';
  direction?: 'increase' | 'decrease';
  metricName?: string;
} {
  let cleanText = text;
  let metricValue: string | undefined;
  let timeframe: '3M' | '6M' | '9M' | '12M' | '18M' | undefined;
  let direction: 'increase' | 'decrease' | undefined;
  let metricName: string | undefined;

  // Extract "from X% to Y%" or "from $X to $Y" patterns
  const fromToMatch = text.match(/from\s+(\$?\d+%?)\s+to\s+(\$?\d+%?)/i);
  if (fromToMatch) {
    metricValue = `from ${fromToMatch[1]} to ${fromToMatch[2]}`;
    cleanText = cleanText.replace(fromToMatch[0], '').trim();
  }

  // Extract "by X%" patterns
  const byPercentMatch = text.match(/by\s+(\d+%)/i);
  if (byPercentMatch && !metricValue) {
    metricValue = byPercentMatch[1];
    cleanText = cleanText.replace(byPercentMatch[0], '').trim();
  }

  // Extract timeframe patterns like "by end of 2023", "by Q2 2024", "within 6 months"
  const timePatterns = [
    { pattern: /by\s+end\s+of\s+\d{4}/i, timeframe: '12M' as const },
    { pattern: /by\s+mid[- ]?\d{4}/i, timeframe: '6M' as const },
    { pattern: /by\s+Q1/i, timeframe: '3M' as const },
    { pattern: /by\s+Q2/i, timeframe: '6M' as const },
    { pattern: /by\s+Q3/i, timeframe: '9M' as const },
    { pattern: /by\s+Q4/i, timeframe: '12M' as const },
    { pattern: /within\s+3\s+months?/i, timeframe: '3M' as const },
    { pattern: /within\s+6\s+months?/i, timeframe: '6M' as const },
    { pattern: /within\s+9\s+months?/i, timeframe: '9M' as const },
    { pattern: /within\s+(12|one\s+year)/i, timeframe: '12M' as const },
    { pattern: /within\s+18\s+months?/i, timeframe: '18M' as const },
  ];

  for (const { pattern, timeframe: tf } of timePatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      timeframe = tf;
      cleanText = cleanText.replace(match[0], '').trim();
      break;
    }
  }

  // Detect direction from keywords
  if (/\b(increase|grow|expand|improve|boost)\b/i.test(text)) {
    direction = 'increase';
  } else if (/\b(decrease|reduce|lower|minimize)\b/i.test(text)) {
    direction = 'decrease';
  }

  // Try to extract metric name from context
  const metricPatterns = [
    { pattern: /\b(revenue|sales|ARR|MRR)\b/i, name: 'Revenue' },
    { pattern: /\bmarket share\b/i, name: 'Market share' },
    { pattern: /\b(customer acquisition|new customers)\b/i, name: 'Customer acquisition' },
    { pattern: /\bchurn\b/i, name: 'Customer churn' },
    { pattern: /\b(engagement|user engagement)\b/i, name: 'User engagement' },
    { pattern: /\bcost per acquisition\b/i, name: 'Cost per acquisition' },
    { pattern: /\bpartnerships?\b/i, name: 'Partnerships' },
  ];

  for (const { pattern, name } of metricPatterns) {
    if (pattern.test(text)) {
      metricName = name;
      break;
    }
  }

  // Clean up extra commas and whitespace
  cleanText = cleanText.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').replace(/,\s*by\s+/i, ' by ').trim();

  return { cleanText, metricValue, timeframe, direction, metricName };
}

export function convertLegacyObjectives(legacyObjectives: string[]): Objective[] {
  // Variety of metric configurations for realistic display (used as fallbacks)
  const metricConfigs = [
    { direction: 'increase' as const, metricName: 'Revenue', metricValue: '$10M ARR', timeframe: '12M' as const },
    { direction: 'increase' as const, metricName: 'Customer acquisition', metricValue: '500 new customers', timeframe: '6M' as const },
    { direction: 'decrease' as const, metricName: 'Customer churn', metricValue: 'from 15% to 8%', timeframe: '9M' as const },
    { direction: 'increase' as const, metricName: 'Market share', metricValue: 'from 20% to 35%', timeframe: '12M' as const },
    { direction: 'increase' as const, metricName: 'User engagement', metricValue: '2x daily active users', timeframe: '3M' as const },
    { direction: 'decrease' as const, metricName: 'Cost per acquisition', metricValue: 'from $200 to $100', timeframe: '6M' as const },
    { direction: 'increase' as const, metricName: 'Partnerships', metricValue: '10 strategic partners', timeframe: '12M' as const },
    { direction: 'increase' as const, metricName: 'Adjacent expansion', metricValue: '3 new verticals', timeframe: '18M' as const },
  ];

  return legacyObjectives.map((obj, index) => {
    // Try to parse the objective text to extract metrics
    const parsed = parseObjectiveText(obj);
    const config = metricConfigs[index % metricConfigs.length];

    // Use parsed values if available, otherwise fall back to config
    const direction = parsed.direction || config.direction;
    const metricName = parsed.metricName || config.metricName;
    const metricValue = parsed.metricValue || config.metricValue;
    const timeframe = parsed.timeframe || config.timeframe;
    const pithy = parsed.cleanText || obj;

    return {
      id: `obj-${index + 1}`,
      pithy,
      metric: {
        summary: '25%',
        full: 'Increase by 25% within 6 months',
        category: 'Growth',
        // New visual format fields
        direction,
        metricName,
        metricValue,
        timeframe,
      },
      explanation: `This objective focuses on ${pithy.toLowerCase()}. It connects to our overall strategy by driving key outcomes that matter to stakeholders.`,
      successCriteria: 'Achievement will be measured through quantifiable metrics and stakeholder feedback.',
    };
  });
}
