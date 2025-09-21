export type Provider = "openai" | "anthropic" | "google" | "xai" | "custom";

export interface AiClient {
  generateObject<T>(opts: {
    schemaName: string;
    system: string;
    user: string;
    model: string;
    temperature: number;
    maxTokens: number;
    schema: any;
  }): Promise<{ object: T; usage: any; finishReason: string }>;
}

export interface AiContextPack {
  specExcerpt: object; // module-scoped
  codeChunks: Array<{ path: string; startLine: number; text: string }>;
  domSnapshot?: string; // for selector healing
  scannerFindings?: object; // semgrep/zap/osv outputs (optional)
}

export interface AiConfig {
  enabled: boolean;
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
  redact?: {
    globs: string[];
    patterns: string[];
  };
  include?: {
    globs: string[];
  };
  chunking?: {
    maxCharsPerChunk: number;
    overlap: number;
  };
  limits?: {
    maxFiles: number;
    maxTotalChars: number;
  };
  testGen?: {
    preferDataTestId: boolean;
    defaultWaitMs: number;
  };
  thresholds?: {
    aiCriticalToFail: boolean;
    treatLowConfidenceAsInfo: boolean;
  };
}

// AI Schema types for different tasks
export interface SpecClarityV1 {
  schema: "SPEC_CLARITY_V1";
  issues: Array<{
    id: string;
    where: string;
    explanation: string;
    suggestion: string;
  }>;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

export interface SelectorHealV1 {
  schema: "SELECTOR_HEAL_V1";
  step: object;
  alternatives: string[];
  confidence: "low" | "medium" | "high";
  notes?: string;
}

export interface SecurityReviewV1 {
  schema: "SECURITY_REVIEW_V1";
  findings: Array<{
    id: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    type: string;
    file: string;
    line: number;
    explanation: string;
    suggestion: string;
  }>;
  specDivergence?: Array<{
    moduleId: string;
    type: string;
    file: string;
    line: number;
    severity: "info" | "low" | "medium" | "high" | "critical";
    explanation: string;
  }>;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

export interface TestGenerationV1 {
  schema: "TEST_GENERATION_V1";
  tests: Array<{
    name: string;
    module: string;
    steps: Array<{
      action: string;
      selector?: string;
      text?: string;
      url?: string;
      description?: string;
    }>;
    priority: "low" | "medium" | "high";
  }>;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

export interface FixSuggestionsV1 {
  schema: "FIX_SUGGESTIONS_V1";
  fixes: Array<{
    file: string;
    startLine: number;
    endLine: number;
    originalCode: string;
    suggestedCode: string;
    explanation: string;
    priority: "low" | "medium" | "high";
  }>;
  confidence: "low" | "medium" | "high";
  notes?: string;
}
