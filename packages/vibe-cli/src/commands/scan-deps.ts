import { runOSV, runTrivyRepo } from "../lib/adapters/index.js";
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
  // Check and install dependency scanning tools (unless skipped)
  if (!opts.skipInstall) {
    if (opts.autoInstall) {
      console.log("🚀 Auto-installing dependency scanning tools...");
    } else {
      console.log("🔍 Checking dependency scanning tools...");
    }
    await checkAndInstallTools(["osv-scanner", "trivy"], {
      skipInstall: opts.skipInstall,
      autoInstall: opts.autoInstall,
    });
  }

  const c1 = await runOSV();
  const c2 = await runTrivyRepo();
  // TODO: Add AI explainer for dependency vulnerabilities

  // Only exit if this is a standalone command (not part of comprehensive scan)
  if ((c1 !== 0 || c2 !== 0) && process.argv.includes("deps")) {
    process.exit(7);
  }
};
