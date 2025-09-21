import { readFileSync } from "node:fs";
import { AiService, AiConfig } from "../lib/ai/index.js";
import { VibeSpec } from "../lib/spec/types.js";
import { artifactsDir } from "./paths.js";

export async function initializeAi(
  config: string,
  overrides: {
    noAi?: boolean;
    aiModel?: string;
    aiTemp?: number;
    aiBudgetTokens?: number;
  } = {}
): Promise<AiService | null> {
  try {
    const YAML = await import("yaml");
    const spec: VibeSpec = YAML.parse(readFileSync(config, "utf-8"));

    if (overrides.noAi || !spec.ai?.enabled) {
      return null;
    }

    const aiConfig: AiConfig = {
      enabled: true,
      provider: spec.ai.provider || "openai",
      model: overrides.aiModel || spec.ai.model || "gpt-4",
      temperature: overrides.aiTemp ?? spec.ai.temperature ?? 0.2,
      maxTokens: overrides.aiBudgetTokens || spec.ai.maxTokens || 4000,
      redact: spec.ai.redact,
      include: spec.ai.include,
      chunking: spec.ai.chunking,
      limits: spec.ai.limits,
      testGen: spec.ai.testGen,
      thresholds: spec.ai.thresholds,
    };

    const aiService = new AiService(aiConfig, artifactsDir());
    const initialized = await aiService.initialize();

    return initialized ? aiService : null;
  } catch (error) {
    console.warn("[vibe][ai] Failed to initialize AI:", error);
    return null;
  }
}

export function addAiFlags(command: any) {
  return command
    .option("--no-ai", "disable AI features")
    .option("--ai-model <id>", "override AI model")
    .option("--ai-temp <n>", "override AI temperature", parseFloat)
    .option("--ai-budget-tokens <n>", "override AI token budget", parseInt)
    .option("--skip-install", "skip automatic tool installation")
    .option(
      "--auto-install",
      "automatically install missing tools without prompting"
    );
}
