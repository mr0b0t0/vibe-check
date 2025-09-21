import { readFileSync, existsSync } from "node:fs";
import { runSemgrep } from "../lib/adapters/index.js";
import { initializeAi } from "../utils/ai.js";
import { checkAndInstallTools } from "../utils/installer.js";

export default async (opts: {
  config: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
  skipInstall?: boolean;
  autoInstall?: boolean;
}) => {
  // Check and install semgrep if needed (unless skipped)
  if (!opts.skipInstall) {
    if (opts.autoInstall) {
      console.log("🚀 Auto-installing semgrep...");
    } else {
      console.log("🔍 Checking semgrep installation...");
    }
    await checkAndInstallTools(["semgrep"], {
      skipInstall: opts.skipInstall,
      autoInstall: opts.autoInstall,
    });
  }

  const code = await runSemgrep();

  // AI security review with scanner findings
  const aiService = await initializeAi(opts.config, {
    noAi: opts.noAi,
    aiModel: opts.aiModel,
    aiTemp: opts.aiTemp,
    aiBudgetTokens: opts.aiBudgetTokens,
  });

  if (aiService) {
    console.log("[vibe][ai] Running AI security review...");
    try {
      const YAML = await import("yaml");
      const spec = YAML.parse(readFileSync(opts.config, "utf-8"));

      // Load scanner findings if available
      let scannerFindings;
      if (existsSync(".vibe/semgrep.json")) {
        scannerFindings = JSON.parse(
          readFileSync(".vibe/semgrep.json", "utf-8")
        );
      }

      // Review each module
      for (const module of spec.modules || []) {
        const review = await aiService.reviewSecurity(
          module.id,
          { module },
          scannerFindings
        );
        if (review) {
          const criticalFindings =
            review.findings?.filter((f: any) => f.severity === "critical") ||
            [];
          const specDivergence =
            review.specDivergence?.filter(
              (d: any) => d.severity === "critical"
            ) || [];

          if (criticalFindings.length > 0 || specDivergence.length > 0) {
            console.log(
              `[vibe][ai] Critical security issues found in ${module.id} (confidence: ${review.confidence})`
            );

            if (
              aiService.shouldFailOnCritical() &&
              review.confidence !== "low"
            ) {
              console.error(
                `[vibe][ai] Failing due to critical AI findings in ${module.id}`
              );
              process.exit(6);
            }
          }
        }
      }
    } catch (error) {
      console.warn("[vibe][ai] Security review failed:", error);
    }
  }

  if (code !== 0) process.exit(6);
};
