/**
 * Opportunity Coaching
 *
 * Client-side heuristics to evaluate opportunity quality.
 * Provides real-time feedback without API calls.
 */

export interface CoachingCriterion {
  id: string;
  label: string;
  passed: boolean;
  suggestion?: string;
}

export interface CoachingResult {
  criteria: CoachingCriterion[];
  overallStrength: 'weak' | 'okay' | 'strong';
}

// Timeframe patterns: Q1-Q4, year, months, weeks
const TIMEFRAME_PATTERN = /\b(Q[1-4]|20\d{2}|\d+\s*(month|week|M|W)s?)\b/i;

// Deliverable indicators: arrows, bullets, semicolons, "deliver", "launch", "ship"
const DELIVERABLE_PATTERN = /→|•|;|\bdeliver\b|\blaunch\b|\bship\b|\bbuild\b|\bcreate\b/i;

// Vague phrases that indicate low specificity
const VAGUE_PATTERNS = [
  /^improve\s+\w+$/i,
  /^enhance\s+\w+$/i,
  /^better\s+\w+$/i,
  /^optimize\s+\w+$/i,
  /^increase\s+\w+$/i,
  /^grow\s+\w+$/i,
];

// Specific action verbs that indicate good specificity
const ACTION_VERBS = /\b(launch|build|create|develop|implement|deploy|integrate|establish|partner|hire|acquire|migrate|design|test|validate|ship|deliver)\b/i;

/**
 * Evaluates an opportunity and returns coaching feedback
 */
export function evaluateOpportunity(content: string): CoachingResult {
  const trimmed = content.trim();
  const criteria: CoachingCriterion[] = [];

  // Criterion 1: Has timeframe
  const hasTimeframe = TIMEFRAME_PATTERN.test(trimmed);
  criteria.push({
    id: 'timeframe',
    label: 'Has a timeframe',
    passed: hasTimeframe,
    suggestion: hasTimeframe ? undefined : 'Add when this should happen (e.g., "Q2", "within 3 months")',
  });

  // Criterion 2: Has deliverables
  const hasDeliverables = DELIVERABLE_PATTERN.test(trimmed);
  criteria.push({
    id: 'deliverables',
    label: 'Clear deliverables',
    passed: hasDeliverables,
    suggestion: hasDeliverables ? undefined : 'Add what you\'ll deliver (use → to list outcomes)',
  });

  // Criterion 3: Specific (not vague)
  const isVague = VAGUE_PATTERNS.some(pattern => pattern.test(trimmed));
  const hasActionVerb = ACTION_VERBS.test(trimmed);
  const isSpecific = !isVague && (hasActionVerb || trimmed.length > 30);
  criteria.push({
    id: 'specific',
    label: 'Specific action',
    passed: isSpecific,
    suggestion: isSpecific ? undefined : 'Be more specific about what you\'ll actually do',
  });

  // Criterion 4: Sufficient detail (word count)
  const wordCount = trimmed.split(/\s+/).length;
  const hasSufficientDetail = wordCount >= 5;
  criteria.push({
    id: 'detail',
    label: 'Enough detail',
    passed: hasSufficientDetail,
    suggestion: hasSufficientDetail ? undefined : 'Add more detail about this opportunity',
  });

  // Calculate overall strength
  const passedCount = criteria.filter(c => c.passed).length;
  let overallStrength: 'weak' | 'okay' | 'strong';

  if (passedCount >= 4) {
    overallStrength = 'strong';
  } else if (passedCount >= 2) {
    overallStrength = 'okay';
  } else {
    overallStrength = 'weak';
  }

  return { criteria, overallStrength };
}

/**
 * Parses opportunity content to extract title and timeframe for card display
 */
export function parseOpportunityContent(content: string): {
  title: string;
  timeframe?: string;
  details?: string;
} {
  const trimmed = content.trim();

  // Extract timeframe
  const timeframeMatch = trimmed.match(TIMEFRAME_PATTERN);
  const timeframe = timeframeMatch?.[0];

  // Split on arrow if present
  const arrowIndex = trimmed.indexOf('→');
  if (arrowIndex > 0) {
    const title = trimmed.substring(0, arrowIndex).trim();
    const details = trimmed.substring(arrowIndex + 1).trim();
    return { title, timeframe, details };
  }

  // Otherwise, first line or first 60 chars is title
  const lines = trimmed.split('\n');
  if (lines.length > 1) {
    return { title: lines[0], timeframe, details: lines.slice(1).join('\n') };
  }

  if (trimmed.length > 60) {
    return { title: trimmed.substring(0, 60) + '...', timeframe, details: trimmed };
  }

  return { title: trimmed, timeframe };
}
