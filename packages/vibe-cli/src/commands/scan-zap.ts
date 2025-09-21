import { runZapBaseline } from "@vibe/adapters";
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
  // Check and install Docker for OWASP ZAP (unless skipped)
  if (!opts.skipInstall) {
    if (opts.autoInstall) {
      console.log("🚀 Auto-installing Docker...");
    } else {
      console.log("🔍 Checking Docker installation...");
    }
    await checkAndInstallTools(["docker"], {
      skipInstall: opts.skipInstall,
      autoInstall: opts.autoInstall,
    });
  }

  const code = await runZapBaseline("http://localhost:3000");
  // TODO: Add AI noise reduction for ZAP findings

  // Only exit if this is a standalone command (not part of comprehensive scan)
  if (code !== 0 && process.argv.includes("zap")) {
    process.exit(9);
  }
};
