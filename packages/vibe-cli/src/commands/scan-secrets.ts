import { runGitleaks } from "@vibe/adapters";
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
  // Check and install gitleaks (unless skipped)
  if (!opts.skipInstall) {
    if (opts.autoInstall) {
      console.log("🚀 Auto-installing gitleaks...");
    } else {
      console.log("🔍 Checking gitleaks installation...");
    }
    await checkAndInstallTools(["gitleaks"], {
      skipInstall: opts.skipInstall,
      autoInstall: opts.autoInstall,
    });
  }

  const code = await runGitleaks();
  // TODO: Add AI explainer for secrets findings

  // Only exit if this is a standalone command (not part of comprehensive scan)
  if (code !== 0 && process.argv.includes("secrets")) {
    process.exit(8);
  }
};
