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

export function convertLegacyObjectives(legacyObjectives: string[]): Objective[] {
  return legacyObjectives.map((obj, index) => ({
    id: `obj-${index + 1}`,
    pithy: obj,
    metric: {
      summary: '25%', // Placeholder
      full: 'Increase by 25% within 6 months',
      category: 'Growth',
    },
    explanation: `This objective focuses on ${obj.toLowerCase()}. It connects to our overall mission by driving key outcomes that matter to stakeholders.`,
    successCriteria: 'Achievement will be measured through quantifiable metrics and stakeholder feedback.',
  }));
}
