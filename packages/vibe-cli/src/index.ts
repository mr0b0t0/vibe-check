import dotenv from "dotenv";
import { Command } from "commander";

// Load environment variables from .env file
dotenv.config();
import specLint from "./commands/spec-lint.js";
import appUp from "./commands/app-up.js";
import uiTest from "./commands/ui-test.js";
import scanCode from "./commands/scan-code.js";
import scanDeps from "./commands/scan-deps.js";
import scanSecrets from "./commands/scan-secrets.js";
import scanZap from "./commands/scan-zap.js";
import scanAll from "./commands/scan-all.js";
import apiTest from "./commands/api-test.js";
import report from "./commands/report.js";
import appDown from "./commands/app-down.js";
import comprehensiveVibe from "./commands/comprehensive-vibe.js";
import { addAiFlags } from "./utils/ai.js";

const program = new Command();
program.name("vibe").description("Spec-driven validation CLI").version("0.1.0");

// Add the comprehensive command as the default action
addAiFlags(
  program
    .option("-c, --config <path>", "path to vibe.yaml", "./specs/vibe.yaml")
    .action(comprehensiveVibe)
);

const specCmd = program.command("spec").description("spec utilities");
addAiFlags(
  specCmd
    .command("lint")
    .option("-c, --config <path>", "path to vibe.yaml", "./specs/vibe.yaml")
).action(specLint);

const appCmd = program.command("app").description("app lifecycle");
appCmd
  .command("up")
  .option("-c, --config <path>", "path to vibe.yaml", "./specs/vibe.yaml")
  .action(appUp);
appCmd.command("down").action(appDown);

const uiCmd = program.command("ui").description("ui tests");
addAiFlags(
  uiCmd
    .command("test")
    .option("-c, --config <path>", "path to vibe.yaml", "./specs/vibe.yaml")
).action(uiTest);

// Add a run command to just execute existing tests
addAiFlags(
  uiCmd.command("run").description("run existing playwright tests")
).action(async (opts: any) => {
  // Import installer functions
  const { checkAndInstallUiTools } = await import("./utils/installer.js");

  console.log("🎭 Running Playwright tests...");

  // Check and install Playwright
  await checkAndInstallUiTools(["playwright"], {
    skipInstall: opts.skipInstall,
    autoInstall: opts.autoInstall,
  });

  const { sh } = await import("./utils/exec.js");

  try {
    console.log("\n🔍 Executing tests...");
    const r = await sh("npx", ["playwright", "test", "--reporter=line"]);

    if (r.stdout) {
      console.log("\n📊 Test Results:");
      console.log(r.stdout);
    }

    if (r.stderr) {
      console.error("\n❌ Test Errors:");
      console.error(r.stderr);
    }

    if (r.code === 0) {
      console.log("\n✅ All tests passed!");
    } else {
      console.log(`\n❌ Tests failed with exit code: ${r.code}`);
    }

    process.exit(r.code);
  } catch (error) {
    console.error("❌ Failed to run tests:", error);
    process.exit(1);
  }
});

// Individual scan commands (under scan:*)
const scanCmd = program
  .command("scan")
  .description("comprehensive security scan with AI analysis");
addAiFlags(scanCmd.option("-c, --config <path>", "./specs/vibe.yaml")).action(
  scanAll
);

// Individual scan subcommands
addAiFlags(
  scanCmd
    .command("code")
    .option("-c, --config <path>", "./specs/vibe.yaml")
    .description("static code analysis only")
).action(scanCode);
addAiFlags(
  scanCmd
    .command("deps")
    .option("-c, --config <path>", "./specs/vibe.yaml")
    .description("dependency vulnerabilities only")
).action(scanDeps);
addAiFlags(
  scanCmd
    .command("secrets")
    .option("-c, --config <path>", "./specs/vibe.yaml")
    .description("secret scanning only")
).action(scanSecrets);
addAiFlags(
  scanCmd
    .command("zap")
    .option("-c, --config <path>", "./specs/vibe.yaml")
    .description("web security scanning only")
).action(scanZap);

const apiCmd = program.command("api").description("api checks");
addAiFlags(
  apiCmd.command("test").option("-c, --config <path>", "./specs/vibe.yaml")
).action(apiTest);

addAiFlags(
  program.command("report").option("-c, --config <path>", "./specs/vibe.yaml")
).action(report);

program.parseAsync(process.argv);
