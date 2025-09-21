import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  checkAndInstallTools,
  checkAndInstallUiTools,
} from "../utils/installer.js";
import { ReportGenerator } from "../utils/report-generator.js";
import { ScanParser } from "../utils/scan-parser.js";
import { artifactsDir } from "../utils/paths.js";
import { initializeAi } from "../utils/ai.js";
import scanCode from "./scan-code.js";
import scanDeps from "./scan-deps.js";
import scanSecrets from "./scan-secrets.js";
import scanZap from "./scan-zap.js";
import uiTest from "./ui-test.js";
import report from "./report.js";

interface ScanResult {
  tool: string;
  version: string;
  status: "SUCCESS" | "FAILED";
  findings: number;
  executionTime: number;
  additionalData?: any;
}

interface UiTestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  executionTime: number;
  details?: any;
}

export default async function comprehensiveVibe(opts: {
  config?: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
  skipInstall?: boolean;
  autoInstall?: boolean;
}) {
  const configPath = opts.config || "./specs/vibe.yaml";

  console.log("🚀 Running Comprehensive Vibe Analysis");
  console.log("==================================================");

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  const YAML = await import("yaml");
  const config = YAML.parse(readFileSync(configPath, "utf-8"));
  const vibeDir = artifactsDir();

  // Clear any existing usage data for a fresh count
  const usageFile = path.join(vibeDir, "ai", "total-usage.json");
  if (existsSync(usageFile)) {
    try {
      writeFileSync(
        usageFile,
        JSON.stringify(
          {
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalCalls: 0,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.warn("⚠️  Could not reset usage tracking:", error);
    }
  }

  console.log("📋 Analysis Plan:");
  console.log("  1. 🔒 Security Scanning (Semgrep, Trivy, OSV, Gitleaks, ZAP)");
  console.log("  2. 🎭 UI Testing (Playwright + AI-generated tests)");
  console.log("  3. 🤖 AI Analysis & Recommendations");
  console.log("  4. 📊 Unified Report Generation");
  console.log("");

  // Step 1: Install all required tools
  console.log("🔧 [1/4] Tool Installation & Verification...");
  const requiredSecurityTools = ["semgrep", "osv-scanner", "gitleaks", "trivy"];
  const requiredUiTools = ["playwright"];

  try {
    if (!opts.skipInstall) {
      await checkAndInstallTools(requiredSecurityTools, {
        skipInstall: opts.skipInstall,
        autoInstall: opts.autoInstall,
      });

      await checkAndInstallUiTools(requiredUiTools, {
        skipInstall: opts.skipInstall,
        autoInstall: opts.autoInstall,
      });
    } else {
      console.log("⏭️  Skipping tool installation check");
    }
  } catch (error) {
    console.error("❌ Tool installation failed:", error);
    console.log(
      "💡 Try running with --auto-install to automatically install missing tools"
    );
  }

  const reportGenerator = new ReportGenerator(vibeDir);
  const scanParser = new ScanParser(vibeDir);
  const scanResults: ScanResult[] = [];
  let uiTestResult: UiTestResult = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    executionTime: 0,
  };
  let hasErrors = false;

  // Step 2: Security Scanning
  console.log("\n🔒 [2/4] Security Analysis...");

  const fullOpts = {
    ...opts,
    config: configPath,
    skipInstall: true, // Skip individual tool checks since we already did comprehensive check
  };

  // Static Code Analysis
  try {
    console.log("  📝 Static Code Analysis (Semgrep)...");
    const startTime = Date.now();
    await scanCode(fullOpts);
    const executionTime = Date.now() - startTime;

    const semgrepFindings = scanParser.parseSemgrepResults();
    scanResults.push({
      tool: "semgrep",
      version: scanParser.getToolVersion("semgrep") || "1.45.0",
      status: "SUCCESS",
      findings: semgrepFindings.total,
      executionTime,
      additionalData: semgrepFindings,
    });
  } catch (error) {
    console.error("❌ Static code analysis failed:", error);
    hasErrors = true;
  }

  // Dependency Scanning
  try {
    console.log("  📦 Dependency Vulnerability Scan (Trivy & OSV-Scanner)...");
    const startTime = Date.now();
    await scanDeps(fullOpts);
    const executionTime = Date.now() - startTime;

    const trivyFindings = scanParser.parseTrivyResults();
    scanResults.push({
      tool: "trivy",
      version: scanParser.getToolVersion("trivy") || "0.66.0",
      status: "SUCCESS",
      findings: trivyFindings.total,
      executionTime: Math.round(executionTime / 2),
      additionalData: trivyFindings,
    });

    const osvFindings = scanParser.parseOsvResults();
    scanResults.push({
      tool: "osv-scanner",
      version: scanParser.getToolVersion("osv-scanner") || "2.2.2",
      status: "SUCCESS",
      findings: osvFindings.total,
      executionTime: Math.round(executionTime / 2),
      additionalData: osvFindings,
    });
  } catch (error) {
    console.error("❌ Dependency scanning failed:", error);
    hasErrors = true;
  }

  // Secret Scanning
  try {
    console.log("  🔐 Secret Detection (Gitleaks)...");
    const startTime = Date.now();
    await scanSecrets(fullOpts);
    const executionTime = Date.now() - startTime;

    const gitleaksFindings = scanParser.parseGitleaksResults();
    scanResults.push({
      tool: "gitleaks",
      version: scanParser.getToolVersion("gitleaks") || "8.21.2",
      status: "SUCCESS",
      findings: gitleaksFindings.total,
      executionTime,
      additionalData: gitleaksFindings,
    });
  } catch (error) {
    console.error("❌ Secret scanning failed:", error);
    hasErrors = true;
  }

  // Web Security Scanning
  if (config.app?.url) {
    try {
      console.log("  🌐 Web Security Scan (OWASP ZAP)...");
      const startTime = Date.now();
      await scanZap(fullOpts);
      const executionTime = Date.now() - startTime;

      scanResults.push({
        tool: "zap",
        version: "latest",
        status: "SUCCESS",
        findings: 0, // ZAP results would need custom parsing
        executionTime,
        additionalData: {},
      });
    } catch (error) {
      console.warn(
        "⚠️  Web security scanning skipped (Docker/ZAP not available)"
      );
    }
  } else {
    console.log("  ⏭️  Web security scan skipped (no app.url configured)");
  }

  // Step 3: UI Testing
  console.log("\n🎭 [3/4] UI Testing & AI Test Generation...");

  try {
    const startTime = Date.now();

    console.log("  🎭 Generating AI-powered UI tests...");

    // Generate and run UI tests with real-time streaming
    const uiTestExitCode = await uiTest({
      ...fullOpts,
      fromComprehensive: true, // Don't exit on test failures
    });

    // Parse test results if available
    const testResultsPath = path.join(vibeDir, "playwright-results.json");
    if (existsSync(testResultsPath)) {
      try {
        const testData = JSON.parse(readFileSync(testResultsPath, "utf-8"));
        const executionTime = Date.now() - startTime;

        // Parse Playwright JSON results properly
        const totalTests =
          (testData.stats?.expected || 0) +
          (testData.stats?.unexpected || 0) +
          (testData.stats?.skipped || 0);
        const passedTests = testData.stats?.expected || 0;
        const failedTests = testData.stats?.unexpected || 0;
        const skippedTests = testData.stats?.skipped || 0;

        uiTestResult = {
          total: totalTests,
          passed: passedTests,
          failed: failedTests,
          skipped: skippedTests,
          executionTime,
        };
      } catch (parseError) {
        console.warn("⚠️  Could not parse UI test results");
      }
    }

    if (uiTestResult.total > 0) {
      console.log(
        `  ✅ UI Tests Complete: ${uiTestResult.passed}/${uiTestResult.total} passed (${uiTestResult.failed} failed)`
      );
    } else {
      console.log(
        "  ⚠️  No UI test results found - tests may not have executed"
      );
    }
  } catch (error) {
    console.error("❌ UI testing failed:", error);
    hasErrors = true;
  }

  // Step 4: AI Analysis & Report Generation
  console.log("\n🤖 [4/4] AI Analysis & Report Generation...");

  let aiUsage;
  if (!opts.noAi) {
    try {
      console.log("  🧠 Generating AI security analysis...");

      // Generate AI analysis (this will accumulate usage automatically)
      await report(fullOpts);

      // Read accumulated AI usage from all operations (UI tests + reports)
      const aiService = await initializeAi(configPath, fullOpts);
      if (aiService) {
        aiUsage = aiService.getTotalUsage();
        console.log(
          `  📊 AI Usage: ${aiUsage.totalTokens.toLocaleString()} tokens (${
            aiUsage.totalCalls
          } calls)`
        );
      }
    } catch (error) {
      console.warn("⚠️  AI analysis failed:", error);
    }
  }

  // Generate comprehensive report with AI usage
  const securityReport = reportGenerator.generateReport(
    scanResults,
    process.cwd(),
    !opts.noAi,
    aiUsage
  );

  // Add UI test results to the report
  const enhancedReport = {
    ...securityReport,
    uiTesting: {
      status: (uiTestResult.failed === 0 ? "PASSED" : "FAILED") as
        | "PASSED"
        | "FAILED",
      summary: {
        total: uiTestResult.total,
        passed: uiTestResult.passed,
        failed: uiTestResult.failed,
        skipped: uiTestResult.skipped,
      },
      executionTime: uiTestResult.executionTime,
    },
  };

  await reportGenerator.saveReports(enhancedReport);

  // Display comprehensive summary
  console.log("\n============================================================");
  console.log("🎯 COMPREHENSIVE VIBE ANALYSIS COMPLETE");
  console.log("============================================================");

  console.log("\n📊 Security Assessment:");
  console.log(
    `   Overall Score: ${securityReport.overallScore.total}/100 (${securityReport.overallScore.grade})`
  );
  console.log(`   Status: ${securityReport.overallScore.status}`);
  console.log(
    `   Security Tools: ${
      scanResults.filter((r) => r.status === "SUCCESS").length
    }/${scanResults.length} successful`
  );

  console.log("\n🎭 UI Testing:");
  console.log(`   Tests: ${uiTestResult.passed}/${uiTestResult.total} passed`);
  console.log(
    `   Status: ${uiTestResult.failed === 0 ? "✅ PASSED" : "❌ FAILED"}`
  );

  if (securityReport.aiAnalysis) {
    console.log("\n🤖 AI Analysis:");
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

      if (criticalCount > 0)
        console.log(`   🚨 ${criticalCount} Critical Issues`);
      if (highCount > 0)
        console.log(`   ⚠️  ${highCount} High Severity Issues`);
      if (mediumCount > 0)
        console.log(`   💡 ${mediumCount} Medium Severity Issues`);
    } else {
      console.log("   ✅ No security issues found");
    }
  }

  if (enhancedReport.aiUsage && enhancedReport.aiUsage.totalTokens > 0) {
    console.log("\n📊 AI Usage:");
    console.log(
      `   Total Calls: ${enhancedReport.aiUsage.totalCalls.toLocaleString()}`
    );
    console.log(
      `   Total Tokens: ${enhancedReport.aiUsage.totalTokens.toLocaleString()}`
    );
    console.log(
      `   Input Tokens: ${enhancedReport.aiUsage.promptTokens.toLocaleString()}`
    );
    console.log(
      `   Output Tokens: ${enhancedReport.aiUsage.completionTokens.toLocaleString()}`
    );
    if (enhancedReport.aiUsage.totalCost) {
      console.log(
        `   Estimated Cost: $${enhancedReport.aiUsage.totalCost.toFixed(4)}`
      );
    }
  }

  console.log("\n📄 Reports Generated:");
  console.log(`   📋 Comprehensive Report: ${vibeDir}/security-report.md`);
  console.log(`   📊 JSON Summary: ${vibeDir}/security-summary.json`);
  console.log(`   🎭 UI Test Results: ${vibeDir}/playwright-results.json`);
  if (!opts.noAi) {
    console.log(`   🤖 AI Analysis: ${vibeDir}/ai/`);
  }

  const overallSuccess =
    !hasErrors &&
    securityReport.overallScore.total >= 70 &&
    uiTestResult.failed === 0;

  console.log(
    `\n🎉 Analysis Status: ${
      overallSuccess ? "✅ PASSED" : "❌ ATTENTION NEEDED"
    }`
  );

  if (!overallSuccess) {
    console.log("\n💡 Recommendations:");
    if (securityReport.overallScore.total < 70) {
      console.log("   • Address security findings to improve score");
    }
    if (uiTestResult.failed > 0) {
      console.log("   • Fix failing UI tests");
    }
    if (hasErrors) {
      console.log("   • Resolve tool execution errors");
    }
  }

  console.log("\n============================================================");

  // Exit with appropriate code
  if (!overallSuccess) {
    process.exit(1);
  }
}
