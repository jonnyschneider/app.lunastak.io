// src/lib/curated-tradeoffs.ts
/**
 * Curated Trade-offs Library
 *
 * Common business trade-offs organized by category.
 * Used for cold start principle selection.
 */

export interface TradeoffOption {
  id: string;
  category: 'growth' | 'culture' | 'product' | 'operations';
  optionA: string;
  optionB: string;
}

export const CURATED_TRADEOFFS: TradeoffOption[] = [
  // Growth
  { id: 'growth-1', category: 'growth', optionA: 'New customers', optionB: 'Customer retention' },
  { id: 'growth-2', category: 'growth', optionA: 'Revenue growth', optionB: 'Profitability' },
  { id: 'growth-3', category: 'growth', optionA: 'Market share', optionB: 'Profit margins' },
  { id: 'growth-4', category: 'growth', optionA: 'Scale fast', optionB: 'Sustainable growth' },
  { id: 'growth-5', category: 'growth', optionA: 'Broad market', optionB: 'Niche focus' },

  // Culture
  { id: 'culture-1', category: 'culture', optionA: 'Move fast', optionB: 'Move carefully' },
  { id: 'culture-2', category: 'culture', optionA: 'Hire specialists', optionB: 'Hire generalists' },
  { id: 'culture-3', category: 'culture', optionA: 'Remote work', optionB: 'Office culture' },
  { id: 'culture-4', category: 'culture', optionA: 'Autonomy', optionB: 'Alignment' },
  { id: 'culture-5', category: 'culture', optionA: 'Transparency', optionB: 'Need-to-know' },

  // Product
  { id: 'product-1', category: 'product', optionA: 'Build in-house', optionB: 'Buy solutions' },
  { id: 'product-2', category: 'product', optionA: 'Feature depth', optionB: 'Feature breadth' },
  { id: 'product-3', category: 'product', optionA: 'User delight', optionB: 'User efficiency' },
  { id: 'product-4', category: 'product', optionA: 'Innovation', optionB: 'Reliability' },
  { id: 'product-5', category: 'product', optionA: 'Customization', optionB: 'Standardization' },

  // Operations
  { id: 'ops-1', category: 'operations', optionA: 'Speed to market', optionB: 'Quality assurance' },
  { id: 'ops-2', category: 'operations', optionA: 'Cost efficiency', optionB: 'Customer experience' },
  { id: 'ops-3', category: 'operations', optionA: 'Process consistency', optionB: 'Situational flexibility' },
  { id: 'ops-4', category: 'operations', optionA: 'Internal capability', optionB: 'Partner ecosystem' },
  { id: 'ops-5', category: 'operations', optionA: 'Short-term results', optionB: 'Long-term positioning' },
];

export const CATEGORY_LABELS: Record<TradeoffOption['category'], string> = {
  growth: 'Growth',
  culture: 'Culture',
  product: 'Product',
  operations: 'Operations',
};

export function getTradeoffsByCategory(category: TradeoffOption['category']): TradeoffOption[] {
  return CURATED_TRADEOFFS.filter((t) => t.category === category);
}
