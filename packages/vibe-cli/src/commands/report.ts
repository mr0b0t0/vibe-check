import { mergeSarif } from "@vibe/reporter";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { initializeAi } from "../utils/ai.js";

export default async (opts: {
  config: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
}) => {
  const sarif = await mergeSarif([
    ".vibe/trivy.sarif",
    ".vibe/codeql.sarif",
    ".vibe/semgrep.sarif",
  ]);
  writeFileSync(".vibe/report.sarif", JSON.stringify(sarif, null, 2));

  // Collect all findings for AI summary
  const allFindings: any[] = [];

  // Add SARIF findings
  allFindings.push({ type: "sarif", data: sarif });

  // Add AI findings
  const aiDir = ".vibe/ai";
  if (existsSync(aiDir)) {
    try {
      const aiFiles = readdirSync(aiDir).filter(
        (f) => f.endsWith(".json") && !f.startsWith("raw-")
      );
      for (const file of aiFiles) {
        const content = JSON.parse(
          readFileSync(path.join(aiDir, file), "utf-8")
        );
        allFindings.push({ type: "ai", source: file, data: content });
      }
    } catch (error) {
      console.warn("[vibe][ai] Could not read AI findings:", error);
    }
  }

  // Generate AI executive summary
  const aiService = await initializeAi(opts.config, {
    noAi: opts.noAi,
    aiModel: opts.aiModel,
    aiTemp: opts.aiTemp,
    aiBudgetTokens: opts.aiBudgetTokens,
  });

  let reportContent = "# Vibe Security & Quality Report\n\n";
  reportContent += `Generated: ${new Date().toISOString()}\n\n`;

  if (aiService && allFindings.length > 0) {
    console.log("[vibe][ai] Generating executive summary...");
    try {
      const summary = await aiService.generateExecutiveSummary(allFindings);
      reportContent += "## Executive Summary (AI Generated)\n\n";
      reportContent += summary + "\n\n";
    } catch (error) {
      console.warn("[vibe][ai] Executive summary generation failed:", error);
      reportContent += "## Executive Summary\n\nAI summary unavailable\n\n";
    }
  }

  // Add artifacts section
  reportContent += "## Artifacts\n\n";
  reportContent += "- **SARIF Report**: `.vibe/report.sarif`\n";
  reportContent +=
    "- **Playwright Results**: `.vibe/playwright-results.json`\n";

  if (existsSync(aiDir)) {
    reportContent += "- **AI Analysis**: `.vibe/ai/` directory\n";
  }

  reportContent += "\n## Tool Outputs\n\n";
  reportContent +=
    "All detailed findings are available in the artifacts directory (`.vibe/`).\n";
  reportContent +=
    "Screenshots and traces from UI tests are in `.vibe/tests/`.\n";

  writeFileSync(".vibe/report.md", reportContent);
  console.log(
    "[vibe] report written to .vibe/report.sarif and .vibe/report.md"
  );
};
