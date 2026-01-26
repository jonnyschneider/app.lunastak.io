/**
 * Opportunity Coaching
 *
 * Client-side heuristics to evaluate opportunity quality.
 * Focuses on strategic clarity (outcomes, rationale) over project-speak (deliverables, timelines).
 *
 * Good opportunities:
 * - Clear outcome focus (what changes if this succeeds)
 * - Rationale present (why this, why now)
 * - Directional, not prescriptive (leaves room for teams to figure out HOW)
 *
 * When we detect project-speak, we reframe it as "possible candidates for HOW"
 * and nudge toward the outcome/rationale.
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

// Project-speak: delivery-focused language (candidates for HOW, not the opportunity itself)
const PROJECT_VERBS = /\b(build|ship|deliver|launch|deploy|implement|develop|create|release|migrate)\b/i;

// Timeframe without context often signals project-speak
const TIMELINE_PATTERN = /\b(Q[1-4]|20\d{2}|\d+\s*(month|week|M|W)s?|by\s+(end\s+of\s+)?(Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December))\b/i;

// Feature/deliverable nouns that suggest HOW not WHY
const FEATURE_NOUNS = /\b(feature|functionality|module|component|system|tool|platform|MVP|prototype|integration|API|dashboard|portal)\b/i;

// Outcome language: signals strategic thinking
const OUTCOME_PATTERNS = /\b(prove|validate|increase|reduce|improve|understand|learn|discover|achieve|enable|unlock|drive|accelerate)\b/i;

// Rationale language: signals evidence-based thinking
const RATIONALE_PATTERNS = /\b(because|evidence|data\s+shows|suggests|indicates|we've\s+seen|customers?\s+(want|need|ask)|market|opportunity|risk|bet)\b/i;

// Trade-off awareness: signals strategic prioritization
const TRADEOFF_PATTERNS = /\b(instead\s+of|rather\s+than|not\s+\w+,?\s+but|focus\s+on|prioritize|over\s+\w+)\b/i;

/**
 * Evaluates an opportunity and returns coaching feedback
 *
 * Philosophy: Better to have clear WHY with vague HOW than the reverse.
 * When we see project-speak, acknowledge it as valid thinking while nudging toward rationale.
 */
export function evaluateOpportunity(content: string): CoachingResult {
  const trimmed = content.trim();
  const criteria: CoachingCriterion[] = [];
  const wordCount = trimmed.split(/\s+/).length;

  // Detect patterns
  const hasProjectVerbs = PROJECT_VERBS.test(trimmed);
  const hasTimeline = TIMELINE_PATTERN.test(trimmed);
  const hasFeatureNouns = FEATURE_NOUNS.test(trimmed);
  const hasOutcomeLanguage = OUTCOME_PATTERNS.test(trimmed);
  const hasRationale = RATIONALE_PATTERNS.test(trimmed);
  const hasTradeoffs = TRADEOFF_PATTERNS.test(trimmed);

  // Is this mostly project-speak? (has delivery language without outcome/rationale)
  const isProjectHeavy = (hasProjectVerbs || hasFeatureNouns) && !hasOutcomeLanguage && !hasRationale;
  const isTimelineOnly = hasTimeline && !hasRationale;

  // Criterion 1: Outcome clarity
  criteria.push({
    id: 'outcome',
    label: 'Clear outcome focus',
    passed: hasOutcomeLanguage || hasTradeoffs,
    suggestion: hasOutcomeLanguage || hasTradeoffs
      ? undefined
      : 'What changes if this succeeds? What outcome are you driving toward?',
  });

  // Criterion 2: Rationale present
  criteria.push({
    id: 'rationale',
    label: 'Rationale present',
    passed: hasRationale,
    suggestion: hasRationale
      ? undefined
      : 'Why this? Why now? What evidence suggests this is worth pursuing?',
  });

  // Criterion 3: Project-speak check (inverted - we want LESS of this)
  // If heavy on project language, reframe as candidates
  if (isProjectHeavy) {
    criteria.push({
      id: 'reframe',
      label: 'Possible candidates identified',
      passed: false,
      suggestion: 'These look like candidates for HOW to achieve this. What\'s the outcome driving them?',
    });
  }

  // Criterion 4: Timeline without context
  if (isTimelineOnly) {
    criteria.push({
      id: 'timeline-context',
      label: 'Timeline has context',
      passed: false,
      suggestion: 'Why this timing? What changes if we wait?',
    });
  }

  // Criterion 5: Sufficient context (not just a heading)
  // Headings are fine, but if there's more, it should add value
  const isJustHeading = wordCount <= 5;
  const hasEnoughContext = isJustHeading || wordCount >= 10;

  if (!isJustHeading && wordCount < 10 && !hasOutcomeLanguage && !hasRationale) {
    criteria.push({
      id: 'context',
      label: 'Enough context',
      passed: false,
      suggestion: 'Add a sentence on why this matters and what you expect to learn or achieve.',
    });
  }

  // Calculate overall strength based on strategic clarity
  const positiveSignals = [hasOutcomeLanguage, hasRationale, hasTradeoffs].filter(Boolean).length;
  const negativeSignals = [isProjectHeavy, isTimelineOnly].filter(Boolean).length;

  let overallStrength: 'weak' | 'okay' | 'strong';

  if (positiveSignals >= 2 && negativeSignals === 0) {
    overallStrength = 'strong';
  } else if (positiveSignals >= 1 || (isJustHeading && negativeSignals === 0)) {
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
  const timeframeMatch = trimmed.match(TIMELINE_PATTERN);
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
