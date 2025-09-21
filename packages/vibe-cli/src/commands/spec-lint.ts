import { readFileSync } from "node:fs";
import { z } from "zod";
import { VibeSchema } from "../lib/spec/types.js";
import { initializeAi } from "../utils/ai.js";

export default async (opts: {
  config: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
}) => {
  const raw = readFileSync(opts.config, "utf-8");
  const data = (await import("yaml")).parse(raw);
  const parsed = VibeSchema.safeParse(data);
  if (!parsed.success) {
    console.error(parsed.error.format());
    process.exit(2);
  }
  console.log("Spec OK");

  // AI clarity review (advisory only)
  const aiService = await initializeAi(opts.config, {
    noAi: opts.noAi,
    aiModel: opts.aiModel,
    aiTemp: opts.aiTemp,
    aiBudgetTokens: opts.aiBudgetTokens,
  });

  if (aiService) {
    console.log("[vibe][ai] Running spec clarity review...");
    try {
      const clarity = await aiService.analyzeSpecClarity(data);
      if (clarity?.issues?.length > 0) {
        console.log(
          `[vibe][ai] Found ${clarity.issues.length} clarity suggestions (see .vibe/ai/spec-clarity.json)`
        );
      } else {
        console.log("[vibe][ai] No clarity issues found");
      }
    } catch (error) {
      console.warn("[vibe][ai] Clarity review failed:", error);
    }
  }
};
