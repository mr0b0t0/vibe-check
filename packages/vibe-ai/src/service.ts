import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AiConfig, AiClient, AiContextPack } from "./types.js";
import { createAiClient } from "./providers/index.js";
import { ContextPacker } from "./context.js";

// Zod schemas for AI responses
const SpecClaritySchema = z.object({
  schema: z.literal("SPEC_CLARITY_V1"),
  issues: z.array(
    z.object({
      id: z.string(),
      where: z.string(),
      explanation: z.string(),
      suggestion: z.string(),
    })
  ),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

const SelectorHealSchema = z.object({
  schema: z.literal("SELECTOR_HEAL_V1"),
  step: z.object({
    action: z.string(),
    selector: z.string().optional(),
    text: z.string().optional(),
    url: z.string().optional(),
    description: z.string().optional(),
  }),
  alternatives: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

const SecurityReviewSchema = z.object({
  schema: z.literal("SECURITY_REVIEW_V1"),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["info", "low", "medium", "high", "critical"]),
      type: z.string(),
      file: z.string(),
      line: z.number(),
      explanation: z.string(),
      suggestion: z.string(),
    })
  ),
  specDivergence: z
    .array(
      z.object({
        moduleId: z.string(),
        type: z.string(),
        file: z.string(),
        line: z.number(),
        severity: z.enum(["info", "low", "medium", "high", "critical"]),
        explanation: z.string(),
      })
    )
    .optional(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

const TestGenerationSchema = z.object({
  schema: z.literal("TEST_GENERATION_V1"),
  tests: z.array(
    z.object({
      name: z.string(),
      module: z.string(),
      steps: z.array(
        z.object({
          action: z.string(),
          selector: z.string().optional(),
          text: z.string().optional(),
          url: z.string().optional(),
          description: z.string().optional(),
        })
      ),
      priority: z.enum(["low", "medium", "high"]),
    })
  ),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

export class AiService {
  private client: AiClient | null = null;
  private contextPacker: ContextPacker;
  private artifactsDir: string;
  private totalUsage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCalls: number;
    totalCost?: number;
  } = {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCalls: 0,
  };

  constructor(private config: AiConfig, artifactsDir: string = ".vibe") {
    this.contextPacker = new ContextPacker(config);
    this.artifactsDir = path.join(artifactsDir, "ai");

    // Ensure artifacts directory exists
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }

    // Load any existing usage data
    this.loadTotalUsage();
  }

  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      console.log("[vibe][ai] disabled in config");
      return false;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.log("[vibe][ai] disabled or unavailable - no API key");
      return false;
    }

    try {
      this.client = createAiClient(this.config.provider, apiKey);
      return true;
    } catch (error) {
      console.error("[vibe][ai] failed to initialize:", error);
      return false;
    }
  }

  async analyzeSpecClarity(spec: object): Promise<any> {
    if (!this.client) return null;

    const system = this.getSystemPrompt();
    const user = `
<spec>
${JSON.stringify(spec, null, 2)}
</spec>

Task: Review this vibe.yaml spec for clarity issues. Look for:
- Missing or ambiguous selectors
- Vague flow descriptions
- Roles not properly linked to pages
- Incomplete test coverage

Output exactly SPEC_CLARITY_V1 JSON schema.
`;

    try {
      const result = await this.client.generateObject({
        schemaName: "SPEC_CLARITY_V1",
        system,
        user,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        schema: SpecClaritySchema,
      });

      await this.saveArtifact("spec-clarity.json", {
        data: result.object,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      return result.object;
    } catch (error) {
      console.error("[vibe][ai] spec clarity analysis failed:", error);
      return null;
    }
  }

  async healSelector(
    specExcerpt: object,
    domSnapshot: string,
    failedStep: object
  ): Promise<any> {
    if (!this.client) return null;

    const system = this.getSystemPrompt();
    const user = `
<spec>
${JSON.stringify(specExcerpt, null, 2)}
</spec>
<dom>
${domSnapshot.slice(0, 50000)}
</dom>
<failed_step>
${JSON.stringify(failedStep)}
</failed_step>

Task: Propose up to 3 alternative selectors that likely match the intended element.
Constraints:
- Prefer [data-testid] if present
- Avoid brittle nth-child selectors unless necessary
- Output SELECTOR_HEAL_V1 JSON only
`;

    try {
      const result = await this.client.generateObject({
        schemaName: "SELECTOR_HEAL_V1",
        system,
        user,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        schema: SelectorHealSchema,
      });

      await this.saveArtifact("selector-heal.json", {
        data: result.object,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      return result.object;
    } catch (error) {
      console.error("[vibe][ai] selector healing failed:", error);
      return null;
    }
  }

  async reviewSecurity(
    moduleId: string,
    specExcerpt: object,
    scannerFindings?: object
  ): Promise<any> {
    if (!this.client) return null;

    const context = await this.contextPacker.packContext(specExcerpt, {
      moduleId,
      scannerFindings,
    });

    const system = this.getSystemPrompt();
    const user = `
<spec>
${JSON.stringify(context.specExcerpt, null, 2)}
</spec>
<code>
${context.codeChunks
  .map(
    (chunk) => `File: ${chunk.path} (lines ${chunk.startLine}+)\n${chunk.text}`
  )
  .join("\n\n")}
</code>
${
  scannerFindings
    ? `<scanner_findings>\n${JSON.stringify(
        scannerFindings,
        null,
        2
      )}\n</scanner_findings>`
    : ""
}

Task: Review for security issues and spec compliance. Focus on:
- Auth/role enforcement matching spec requirements
- Authorization bypass opportunities
- Spec divergence in access controls
- Critical security patterns

Output exactly SECURITY_REVIEW_V1 JSON schema.
`;

    try {
      const result = await this.client.generateObject({
        schemaName: "SECURITY_REVIEW_V1",
        system,
        user,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        schema: SecurityReviewSchema,
      });

      await this.saveArtifact(`security-${moduleId}.json`, {
        data: result.object,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      return result.object;
    } catch (error) {
      console.error(
        `[vibe][ai] security review failed for ${moduleId}:`,
        error
      );
      return null;
    }
  }

  async generateTests(moduleId: string, specExcerpt: object): Promise<any> {
    if (!this.client) return null;

    const context = await this.contextPacker.packContext(specExcerpt, {
      moduleId,
    });

    const system = this.getSystemPrompt();
    const user = `
<spec>
${JSON.stringify(context.specExcerpt, null, 2)}
</spec>
<code>
${context.codeChunks
  .map(
    (chunk) => `File: ${chunk.path} (lines ${chunk.startLine}+)\n${chunk.text}`
  )
  .join("\n\n")}
</code>

Task: Analyze test coverage gaps and propose additional test cases for better coverage.
Focus on:
- Edge cases not covered by existing flows
- Error scenarios
- Role-based access variations
- Integration points

Each test step should be a Playwright action with these properties:
- action: "goto", "click", "fill", "select", "wait", "expect", etc.
- selector: CSS/XPath selector (for click, fill, expect actions)
- text: Text content (for fill, expect actions)
- url: URL (for goto action)
- description: Human-readable description of the step

Output exactly TEST_GENERATION_V1 JSON schema.
`;

    try {
      const result = await this.client.generateObject({
        schemaName: "TEST_GENERATION_V1",
        system,
        user,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        schema: TestGenerationSchema,
      });

      await this.saveArtifact(`tests-${moduleId}.json`, {
        data: result.object,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      return result.object;
    } catch (error) {
      console.error(
        `[vibe][ai] test generation failed for ${moduleId}:`,
        error
      );
      return null;
    }
  }

  async generateExecutiveSummary(allFindings: object[]): Promise<string> {
    if (!this.client) return "AI summary unavailable";

    const system = this.getSystemPrompt();
    const user = `
<findings>
${JSON.stringify(allFindings, null, 2)}
</findings>

Task: Create an executive summary of all findings with:
- P0/P1/P2 priority classification
- Fix order recommendations
- Key security and compliance risks
- Overall project health assessment

Output as markdown text (not JSON).
`;

    try {
      // For executive summary, we'll use a simple text generation approach
      // since the AI SDK works better with structured schemas
      const summarySchema = z.object({
        summary: z.string(),
        priorities: z.array(
          z.object({
            level: z.enum(["P0", "P1", "P2"]),
            description: z.string(),
          })
        ),
        recommendations: z.array(z.string()),
      });

      const result = await this.client.generateObject({
        schemaName: "EXECUTIVE_SUMMARY",
        system,
        user:
          user +
          "\n\nOutput as a structured summary with priorities and recommendations.",
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        schema: summarySchema,
      });

      const summaryObj = result.object as {
        summary: string;
        priorities: Array<{ level: "P0" | "P1" | "P2"; description: string }>;
        recommendations: string[];
      };

      const summary =
        summaryObj.summary +
        "\n\n## Priorities\n" +
        summaryObj.priorities
          .map((p) => `- **${p.level}**: ${p.description}`)
          .join("\n") +
        "\n\n## Recommendations\n" +
        summaryObj.recommendations.map((r) => `- ${r}`).join("\n");

      await this.saveArtifact("summary.md", {
        data: summary,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      return summary;
    } catch (error) {
      console.error("[vibe][ai] executive summary generation failed:", error);
      return "Failed to generate AI summary";
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && this.client !== null;
  }

  shouldFailOnCritical(): boolean {
    return this.config.thresholds?.aiCriticalToFail ?? true;
  }

  shouldTreatLowConfidenceAsInfo(): boolean {
    return this.config.thresholds?.treatLowConfidenceAsInfo ?? true;
  }

  private getSystemPrompt(): string {
    return 'You are Vibe-AI, a cautious senior code auditor. Output **exactly** the requested JSON schema. If uncertain, set "confidence":"low" and explain.';
  }

  private getApiKey(): string | null {
    switch (this.config.provider) {
      case "openai":
        return process.env.OPENAI_API_KEY || null;
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY || null;
      case "google":
        return process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
      case "xai":
        return process.env.XAI_API_KEY || null;
      case "custom":
        return process.env.CUSTOM_API_KEY || null;
      default:
        return null;
    }
  }

  private async saveArtifact(
    filename: string,
    result: { data: any; usage?: any; finishReason?: string }
  ): Promise<void> {
    const filepath = path.join(this.artifactsDir, filename);

    // Save structured data
    fs.writeFileSync(filepath, JSON.stringify(result.data, null, 2));

    // Track usage
    if (result.usage) {
      this.accumulateUsage(result.usage);
      this.saveTotalUsage(); // Save updated usage immediately
    }

    // Also save metadata for debugging
    if (result.usage || result.finishReason) {
      const metaFilepath = path.join(this.artifactsDir, `meta-${filename}`);
      fs.writeFileSync(
        metaFilepath,
        JSON.stringify(
          {
            usage: result.usage,
            finishReason: result.finishReason,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
  }

  private accumulateUsage(usage: any): void {
    if (!usage) return;

    this.totalUsage.totalCalls++;

    // Handle different usage formats from different providers
    if (usage.totalTokens) {
      this.totalUsage.totalTokens += usage.totalTokens;
    }
    if (usage.promptTokens) {
      this.totalUsage.promptTokens += usage.promptTokens;
    }
    if (usage.completionTokens) {
      this.totalUsage.completionTokens += usage.completionTokens;
    }

    // Some providers might use different field names
    if (usage.input_tokens) {
      this.totalUsage.promptTokens += usage.input_tokens;
    }
    if (usage.output_tokens) {
      this.totalUsage.completionTokens += usage.output_tokens;
    }

    // Calculate total if not provided
    if (
      !this.totalUsage.totalTokens &&
      (this.totalUsage.promptTokens || this.totalUsage.completionTokens)
    ) {
      this.totalUsage.totalTokens =
        this.totalUsage.promptTokens + this.totalUsage.completionTokens;
    }
  }

  getTotalUsage(): {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCalls: number;
    totalCost?: number;
  } {
    return { ...this.totalUsage };
  }

  saveTotalUsage(): void {
    const usageFile = path.join(this.artifactsDir, "total-usage.json");
    fs.writeFileSync(usageFile, JSON.stringify(this.totalUsage, null, 2));
  }

  loadTotalUsage(): void {
    const usageFile = path.join(this.artifactsDir, "total-usage.json");
    if (fs.existsSync(usageFile)) {
      try {
        const savedUsage = JSON.parse(fs.readFileSync(usageFile, "utf-8"));
        this.totalUsage = { ...this.totalUsage, ...savedUsage };
      } catch (error) {
        console.warn("[vibe][ai] Failed to load total usage:", error);
      }
    }
  }
}
