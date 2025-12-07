export interface BusinessContext {
  industry: string;
  targetMarket: string;
  uniqueValue: string;
}

export interface StrategyStatements {
  vision: string;
  mission: string;
  objectives: string[];
}

export interface GenerationResponse {
  thoughts: string;
  statements: StrategyStatements;
}

export interface EvaluationResponse {
  evaluation: "PASS" | "NEEDS_IMPROVEMENT" | "FAIL";
  feedback: string;
}
