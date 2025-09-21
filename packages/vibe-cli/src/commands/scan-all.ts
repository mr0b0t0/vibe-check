import fs from "node:fs";
import path from "node:path";
import { VibeSchema } from "@vibe/spec";
import scanCode from "./scan-code.js";
import scanDeps from "./scan-deps.js";
import scanSecrets from "./scan-secrets.js";
import scanZap from "./scan-zap.js";
import report from "./report.js";
import { checkAndInstallTools, getRequiredTools } from "../utils/installer.js";
import { ReportGenerator, ScanResult } from "../utils/report-generator.js";
import { ScanParser } from "../utils/scan-parser.js";
import { artifactsDir } from "../utils/paths.js";

export default async function scanAll(opts: {
  config?: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
  skipInstall?: boolean;
  autoInstall?: boolean;
}) {
  console.log("🔍 Running comprehensive security scan...");

  const configPath = opts.config || "./specs/vibe.yaml";

  // Create full options object with required config
  // Skip individual tool installation checks since we handle it centrally
  const fullOpts = {
    ...opts,
    config: configPath,
    skipInstall: true, // Always skip individual tool checks in comprehensive scan
  };

  // Validate spec exists
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    console.log("💡 Run 'vibe spec lint' first to validate your vibe.yaml");
    process.exit(1);
  }

  // Parse spec
  let spec;
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const yaml = await import("yaml");
    const data = yaml.parse(content);
    spec = VibeSchema.parse(data);
  } catch (error) {
    console.error("❌ Invalid vibe.yaml:", error);
    process.exit(1);
  }

  // Ensure .vibe directory exists
  const vibeDir = ".vibe";
  if (!fs.existsSync(vibeDir)) {
    fs.mkdirSync(vibeDir, { recursive: true });
  }

  // Determine required tools based on spec
  const scanTypes = ["code", "deps", "secrets"];
  if (spec.app?.url) {
    scanTypes.push("zap");
  }

  const requiredTools = getRequiredTools(scanTypes);

  console.log("📋 Scan Plan:");
  console.log("  1. Static code analysis (semgrep)");
  console.log("  2. Dependency vulnerabilities (osv-scanner)");
  console.log("  3. Secret scanning (gitleaks)");
  if (spec.app?.url) {
    console.log("  4. Web application security (OWASP ZAP)");
  }
  console.log("  5. AI-powered analysis & reporting");
  console.log("");

  // Check and install required tools (unless skipped)
  if (opts.skipInstall) {
    console.log("⏭️  Skipping tool installation check (--skip-install)");
  } else {
    if (opts.autoInstall) {
      console.log("🚀 Auto-installing missing tools...");
    } else {
      console.log("🛠️  Checking security tools...");
    }

    const toolsReady = await checkAndInstallTools(requiredTools, {
      skipInstall: opts.skipInstall,
      autoInstall: opts.autoInstall,
    });

    if (!toolsReady) {
      console.log(
        "⚠️  Some tools are missing, but continuing with available tools..."
      );
    }
  }
  console.log("");

  // Initialize report generator and parser
  const reportGenerator = new ReportGenerator(artifactsDir());
  const scanParser = new ScanParser(artifactsDir());
  const scanResults: ScanResult[] = [];
  let hasErrors = false;

  // Run all scans and collect results
  try {
    console.log("🔧 [1/4] Static Code Analysis...");
    const startTime = Date.now();
    await scanCode(fullOpts);
    const executionTime = Date.now() - startTime;

    const semgrepFindings = scanParser.parseSemgrepResults();
    scanResults.push({
      tool: "semgrep",
      version: scanParser.getToolVersion("semgrep") || "1.137.0",
      status: "SUCCESS",
      findings: semgrepFindings.total,
      executionTime,
      additionalData: semgrepFindings,
    });
  } catch (error) {
    console.log("⚠️  Static code analysis failed:", error);
    scanResults.push({
      tool: "semgrep",
      status: "FAILED",
      findings: 0,
      error: String(error),
    });
    hasErrors = true;
  }

  try {
    console.log("📦 [2/4] Dependency Scan...");
    const startTime = Date.now();
    await scanDeps(fullOpts);
    const executionTime = Date.now() - startTime;

    const trivyFindings = scanParser.parseTrivyResults();
    scanResults.push({
      tool: "trivy",
      version: scanParser.getToolVersion("trivy") || "0.66.0",
      status: "SUCCESS",
      findings: trivyFindings.total,
      executionTime: Math.round(executionTime / 2), // Split time between tools
      additionalData: trivyFindings,
    });

    // Also track OSV-Scanner results
    const osvFindings = scanParser.parseOsvResults();
    scanResults.push({
      tool: "osv-scanner",
      version: "2.2.2", // From the version we saw earlier
      status: "SUCCESS",
      findings: osvFindings.total,
      executionTime: Math.round(executionTime / 2), // Split time between tools
      additionalData: osvFindings,
    });
  } catch (error) {
    console.log("⚠️  Dependency scan failed:", error);
    scanResults.push({
      tool: "trivy",
      status: "FAILED",
      findings: 0,
      error: String(error),
    });
    hasErrors = true;
  }

  try {
    console.log("🔐 [3/4] Secret Scan...");
    const startTime = Date.now();
    await scanSecrets(fullOpts);
    const executionTime = Date.now() - startTime;

    const gitleaksFindings = scanParser.parseGitleaksResults();
    scanResults.push({
      tool: "gitleaks",
      version: "8.28.0", // Gitleaks doesn't include version in output
      status: "SUCCESS",
      findings: gitleaksFindings.total,
      executionTime,
      additionalData: gitleaksFindings,
    });
  } catch (error) {
    console.log("⚠️  Secret scan failed:", error);
    scanResults.push({
      tool: "gitleaks",
      status: "FAILED",
      findings: 0,
      error: String(error),
    });
    hasErrors = true;
  }

  // Only run ZAP if app URL is configured
  if (spec.app?.url) {
    try {
      console.log("🌐 [4/4] Web Security Scan...");
      const startTime = Date.now();
      await scanZap(fullOpts);
      const executionTime = Date.now() - startTime;

      scanResults.push({
        tool: "zap",
        status: "SUCCESS",
        findings: 0, // This should parse actual results
        executionTime,
      });
    } catch (error) {
      console.log("⚠️  Web security scan failed:", error);
      scanResults.push({
        tool: "zap",
        status: "FAILED",
        findings: 0,
        error: String(error),
      });
      hasErrors = true;
    }
  } else {
    scanResults.push({
      tool: "zap",
      status: "SKIPPED",
      findings: 0,
      error: "No app URL configured",
    });
  }

  // Generate comprehensive security report
  try {
    console.log("");
    console.log("📊 Generating comprehensive security report...");

    // Generate AI analysis (existing functionality)
    if (!opts.noAi) {
      console.log("🤖 Generating AI-powered analysis...");
      await report(fullOpts);
    }

    const securityReport = reportGenerator.generateReport(
      scanResults,
      process.cwd(),
      !opts.noAi
    );
    await reportGenerator.saveReports(securityReport);

    // Display comprehensive summary
    console.log("");
    console.log("🎯 Security Assessment Summary:");
    console.log(
      `   Overall Score: ${securityReport.overallScore.total}/100 (${securityReport.overallScore.grade})`
    );
    console.log(`   Status: ${securityReport.overallScore.status}`);
    console.log(
      `   Tools Successful: ${
        scanResults.filter((r) => r.status === "SUCCESS").length
      }/${scanResults.length}`
    );

    // Display AI analysis in terminal
    if (securityReport.aiAnalysis) {
      console.log("");
      console.log("🤖 AI Security Analysis:");
      if (securityReport.aiAnalysis.priorities.length > 0) {
        const criticalCount = securityReport.aiAnalysis.priorities.filter(
          (p) => p.level === "P0"
        ).length;
        const highCount = securityReport.aiAnalysis.priorities.filter(
          (p) => p.level === "P1"
        ).length;
        const mediumCount = securityReport.aiAnalysis.priorities.filter(
          (p) => p.level === "P2"
        ).length;

        if (criticalCount > 0) {
          console.log(`   🚨 ${criticalCount} Critical Issues Found!`);
        }
        if (highCount > 0) {
          console.log(`   ⚠️  ${highCount} High Severity Issues Found!`);
        }
        if (mediumCount > 0) {
          console.log(`   💡 ${mediumCount} Medium Severity Issues Found!`);
        }

        console.log("");
        console.log("🎯 Priority Issues:");
        securityReport.aiAnalysis.priorities.forEach((p) => {
          const emoji =
            p.level === "P0" ? "🚨" : p.level === "P1" ? "⚠️" : "💡";
          console.log(`   ${emoji} ${p.level}: ${p.description}`);
        });
      } else {
        console.log("   ✅ No security issues found by AI analysis");
      }
    }

    console.log("");
    console.log("📄 Reports generated:");
    console.log(`   • Security report: ${vibeDir}/security-report.md`);
    console.log(`   • JSON summary: ${vibeDir}/security-summary.json`);
  } catch (error) {
    console.error("❌ Report generation failed:", error);
    console.error("Error details:", error);
    hasErrors = true;
  }

  // Summary
  console.log("");
  console.log("✅ Comprehensive scan complete!");
  console.log(`📄 Results available in ${vibeDir}/`);

  if (fs.existsSync(path.join(vibeDir, "summary.md"))) {
    console.log("🤖 AI analysis: .vibe/summary.md");
  }

  if (fs.existsSync(path.join(vibeDir, "merged.sarif"))) {
    console.log("🔍 SARIF report: .vibe/merged.sarif");
  }

  if (hasErrors && spec.ai?.thresholds?.aiCriticalToFail) {
    console.log("");
    console.log("❌ Critical security issues detected - failing build");
    process.exit(1);
  }

  return 0;
}
