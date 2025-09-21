import fs from "node:fs";
import path from "node:path";

export interface ScanResult {
  tool: string;
  version?: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  findings: number;
  error?: string;
  executionTime?: number;
  additionalData?: any;
}

export interface SecurityReport {
  metadata: {
    projectName: string;
    scanDate: string;
    scanTime: string;
    vibeVersion: string;
    scanDurationMinutes: number;
  };
  overallScore: {
    total: number;
    maxPossible: number;
    grade: string;
    status: "PASSED" | "FAILED";
  };
  categoryScores: {
    staticAnalysis: { score: number; max: number; status: string };
    secretDetection: { score: number; max: number; status: string };
    dependencySecurity: { score: number; max: number; status: string };
    webSecurity: { score: number; max: number; status: string };
    toolCoverage: { score: number; max: number; status: string };
  };
  tools: ScanResult[];
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  aiAnalysis?: {
    summary: string;
    priorities: Array<{ level: "P0" | "P1" | "P2"; description: string }>;
    recommendations: string[];
    criticalIssues: number;
  };
  uiTesting?: {
    status: "PASSED" | "FAILED" | "SKIPPED";
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
    };
    executionTime: number;
  };
  aiUsage?: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCalls: number;
    totalCost?: number;
  };
}

export class ReportGenerator {
  private artifactsDir: string;
  private startTime: Date;

  constructor(artifactsDir: string) {
    this.artifactsDir = artifactsDir;
    this.startTime = new Date();
  }

  generateReport(
    scanResults: ScanResult[],
    projectPath: string,
    includeAi: boolean = true,
    aiUsage?: {
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalCalls: number;
      totalCost?: number;
    }
  ): SecurityReport {
    const endTime = new Date();
    const scanDuration = Math.round(
      (endTime.getTime() - this.startTime.getTime()) / 1000 / 60
    );

    const projectName = path.basename(projectPath) || "Unknown Project";

    // Calculate scores
    const scores = this.calculateScores(scanResults);

    // Generate recommendations
    const recommendations = this.generateRecommendations(scanResults);

    // Count findings across all tools
    const findings = this.aggregateFindings(scanResults);

    // Parse AI analysis if available
    const aiAnalysis = includeAi ? this.parseAiAnalysis() : undefined;

    // Adjust score based on AI findings
    if (aiAnalysis) {
      let aiPenalty = 0;
      aiAnalysis.priorities.forEach((priority) => {
        switch (priority.level) {
          case "P0": // Critical issues
            aiPenalty += 15;
            break;
          case "P1": // High severity issues
            aiPenalty += 10;
            break;
          case "P2": // Medium severity issues
            aiPenalty += 5;
            break;
        }
      });
      scores.total = Math.max(scores.total - aiPenalty, 0);
    }

    const report: SecurityReport = {
      metadata: {
        projectName,
        scanDate: endTime.toISOString().split("T")[0],
        scanTime: endTime.toLocaleTimeString(),
        vibeVersion: "0.1.0",
        scanDurationMinutes: Math.max(scanDuration, 1),
      },
      overallScore: {
        total: scores.total,
        maxPossible: 100,
        grade: this.getGrade(scores.total),
        status: scores.total >= 70 ? "PASSED" : "FAILED",
      },
      categoryScores: scores.categories,
      tools: scanResults,
      findings,
      recommendations,
      aiAnalysis,
      aiUsage,
    };

    return report;
  }

  async saveReports(report: SecurityReport): Promise<void> {
    // Ensure artifacts directory exists
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }

    // Save JSON summary
    const jsonPath = path.join(this.artifactsDir, "security-summary.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save Markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdPath = path.join(this.artifactsDir, "security-report.md");
    fs.writeFileSync(mdPath, markdownReport);

    console.log(`📊 Security reports generated:`);
    console.log(`   📄 Detailed report: ${mdPath}`);
    console.log(`   📊 JSON summary: ${jsonPath}`);
  }

  private calculateScores(scanResults: ScanResult[]) {
    const categories = {
      staticAnalysis: { score: 0, max: 25, status: "FAILED" },
      secretDetection: { score: 0, max: 20, status: "FAILED" },
      dependencySecurity: { score: 0, max: 25, status: "FAILED" },
      webSecurity: { score: 0, max: 20, status: "FAILED" },
      toolCoverage: { score: 0, max: 10, status: "FAILED" },
    };

    let successfulTools = 0;
    const totalTools = scanResults.length;

    for (const result of scanResults) {
      if (result.status === "SUCCESS") {
        successfulTools++;

        switch (result.tool) {
          case "semgrep":
            categories.staticAnalysis.score = categories.staticAnalysis.max;
            categories.staticAnalysis.status = "EXCELLENT";
            break;
          case "gitleaks":
            categories.secretDetection.score = categories.secretDetection.max;
            categories.secretDetection.status = "EXCELLENT";
            break;
          case "trivy":
            categories.dependencySecurity.score += 12; // Partial credit for Trivy
            break;
          case "osv-scanner":
            categories.dependencySecurity.score += 13; // Credit for OSV-Scanner
            break;
          case "docker":
          case "zap":
            categories.webSecurity.score = categories.webSecurity.max;
            categories.webSecurity.status = "EXCELLENT";
            break;
        }
      }
    }

    // Tool coverage scoring
    const coveragePercentage = (successfulTools / totalTools) * 100;
    if (coveragePercentage >= 80) {
      categories.toolCoverage.score = categories.toolCoverage.max;
      categories.toolCoverage.status = "EXCELLENT";
    } else if (coveragePercentage >= 60) {
      categories.toolCoverage.score = Math.round(
        categories.toolCoverage.max * 0.8
      );
      categories.toolCoverage.status = "GOOD";
    } else if (coveragePercentage >= 40) {
      categories.toolCoverage.score = Math.round(
        categories.toolCoverage.max * 0.6
      );
      categories.toolCoverage.status = "FAIR";
    } else {
      categories.toolCoverage.score = 0;
      categories.toolCoverage.status = "FAILED";
    }

    // Cap all scores at their maximum and set status
    Object.entries(categories).forEach(([key, category]) => {
      category.score = Math.min(category.score, category.max);

      if (category.score >= category.max) {
        category.status = "EXCELLENT";
      } else if (category.score >= category.max * 0.8) {
        category.status = "GOOD";
      } else if (category.score >= category.max * 0.6) {
        category.status = "FAIR";
      } else {
        category.status = "FAILED";
      }
    });

    const total = Math.min(
      100,
      Object.values(categories).reduce((sum, cat) => sum + cat.score, 0)
    );

    return { categories, total };
  }

  private getGrade(score: number): string {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 70) return "Fair";
    if (score >= 60) return "Poor";
    return "Critical";
  }

  private generateRecommendations(scanResults: ScanResult[]) {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    const failed = scanResults.filter((r) => r.status === "FAILED");
    const skipped = scanResults.filter((r) => r.status === "SKIPPED");

    // Immediate actions for failed tools
    for (const tool of failed) {
      switch (tool.tool) {
        case "osv-scanner":
          immediate.push("Update Go to version 1.23+ to enable OSV-Scanner");
          break;
        case "semgrep":
          immediate.push("Install semgrep: brew install semgrep");
          break;
        case "gitleaks":
          immediate.push("Install gitleaks: brew install gitleaks");
          break;
        case "trivy":
          immediate.push("Install trivy: brew install trivy");
          break;
      }
    }

    // Actions for skipped tools
    for (const tool of skipped) {
      switch (tool.tool) {
        case "docker":
        case "zap":
          immediate.push(
            "Start Docker daemon to enable OWASP ZAP web security testing"
          );
          break;
      }
    }

    // Standard recommendations
    if (immediate.length > 0) {
      shortTerm.push("Re-run comprehensive scan after fixing tool issues");
    }

    shortTerm.push("Integrate security scanning into CI/CD pipeline");
    shortTerm.push("Set up automated security monitoring");

    longTerm.push("Implement automated security monitoring");
    longTerm.push("Schedule regular dependency updates");
    longTerm.push("Add security training for development team");

    return { immediate, shortTerm, longTerm };
  }

  private aggregateFindings(scanResults: ScanResult[]) {
    let critical = 0,
      high = 0,
      medium = 0,
      low = 0,
      info = 0,
      total = 0;

    for (const result of scanResults) {
      if (result.additionalData) {
        const findings = result.additionalData;
        critical += findings.critical || 0;
        high += findings.high || 0;
        medium += findings.medium || 0;
        low += findings.low || 0;
        info += findings.info || 0;
        total += findings.total || 0;
      } else {
        total += result.findings || 0;
        // If no severity breakdown, treat all as medium
        if (result.findings > 0) {
          medium += result.findings;
        }
      }
    }

    return { critical, high, medium, low, info, total };
  }

  private generateMarkdownReport(report: SecurityReport): string {
    const {
      metadata,
      overallScore,
      categoryScores,
      tools,
      findings,
      recommendations,
    } = report;

    return `# 🛡️ Vibe Security Assessment Report

**Project**: ${metadata.projectName}  
**Scan Date**: ${metadata.scanDate}  
**Scan Duration**: ~${metadata.scanDurationMinutes} minutes  
**Vibe CLI Version**: ${metadata.vibeVersion}

---

## 📊 Executive Summary

### 🎯 Overall Security Score: **${overallScore.total}/100** (${
      overallScore.grade
    })

| Category                 | Score | Status            | Details                  |
| ------------------------ | ----- | ----------------- | ------------------------ |
| **Static Code Analysis** | ${categoryScores.staticAnalysis.score}/${
      categoryScores.staticAnalysis.max
    } | ${this.getStatusEmoji(categoryScores.staticAnalysis.status)} **${
      categoryScores.staticAnalysis.status
    }** | ${this.getStatusDescription(categoryScores.staticAnalysis.status)} |
| **Secret Detection**     | ${categoryScores.secretDetection.score}/${
      categoryScores.secretDetection.max
    } | ${this.getStatusEmoji(categoryScores.secretDetection.status)} **${
      categoryScores.secretDetection.status
    }** | ${this.getStatusDescription(categoryScores.secretDetection.status)} |
| **Dependency Security**  | ${categoryScores.dependencySecurity.score}/${
      categoryScores.dependencySecurity.max
    } | ${this.getStatusEmoji(categoryScores.dependencySecurity.status)} **${
      categoryScores.dependencySecurity.status
    }** | ${this.getStatusDescription(
      categoryScores.dependencySecurity.status
    )} |
| **Web Security**         | ${categoryScores.webSecurity.score}/${
      categoryScores.webSecurity.max
    } | ${this.getStatusEmoji(categoryScores.webSecurity.status)} **${
      categoryScores.webSecurity.status
    }** | ${this.getStatusDescription(categoryScores.webSecurity.status)} |
| **Tool Coverage**        | ${categoryScores.toolCoverage.score}/${
      categoryScores.toolCoverage.max
    } | ${this.getStatusEmoji(categoryScores.toolCoverage.status)} **${
      categoryScores.toolCoverage.status
    }** | ${this.getStatusDescription(categoryScores.toolCoverage.status)} |

---

## 🔍 Detailed Scan Results

${tools.map((tool) => this.generateToolSection(tool)).join("\n\n")}

${report.uiTesting ? this.generateUiTestingSection(report.uiTesting) : ""}

${report.aiAnalysis ? this.generateAiSection(report.aiAnalysis) : ""}

${report.aiUsage ? this.generateAiUsageSection(report.aiUsage) : ""}

---

## 🏆 Security Posture Assessment

### ✅ Strengths
${this.generateStrengths(tools)}

### ⚠️ Areas for Improvement
${this.generateImprovements(tools)}

### 🔧 Recommendations

#### Immediate Actions (Priority: High)
${recommendations.immediate.map((rec) => `- ${rec}`).join("\n")}

#### Short-term (This Week)
${recommendations.shortTerm.map((rec) => `- ${rec}`).join("\n")}

#### Long-term (Ongoing)
${recommendations.longTerm.map((rec) => `- ${rec}`).join("\n")}

---

## 🎯 Security Score Breakdown

\`\`\`
Static Code Security     ${"█".repeat(
      Math.round(categoryScores.staticAnalysis.score)
    )} ${categoryScores.staticAnalysis.score}/${
      categoryScores.staticAnalysis.max
    } (${Math.round(
      (categoryScores.staticAnalysis.score /
        categoryScores.staticAnalysis.max) *
        100
    )}%)
Secret Management        ${"█".repeat(
      Math.round(categoryScores.secretDetection.score)
    )} ${categoryScores.secretDetection.score}/${
      categoryScores.secretDetection.max
    } (${Math.round(
      (categoryScores.secretDetection.score /
        categoryScores.secretDetection.max) *
        100
    )}%)
Dependency Security      ${"█".repeat(
      Math.round(categoryScores.dependencySecurity.score)
    )} ${categoryScores.dependencySecurity.score}/${
      categoryScores.dependencySecurity.max
    } (${Math.round(
      (categoryScores.dependencySecurity.score /
        categoryScores.dependencySecurity.max) *
        100
    )}%)
Web Application Security ${"█".repeat(
      Math.round(categoryScores.webSecurity.score)
    )} ${categoryScores.webSecurity.score}/${
      categoryScores.webSecurity.max
    } (${Math.round(
      (categoryScores.webSecurity.score / categoryScores.webSecurity.max) * 100
    )}%)
Tool Coverage           ${"█".repeat(
      Math.round(Math.min(categoryScores.toolCoverage.score, 20))
    )} ${categoryScores.toolCoverage.score}/${
      categoryScores.toolCoverage.max
    } (${Math.round(
      (categoryScores.toolCoverage.score / categoryScores.toolCoverage.max) *
        100
    )}%)
                        ────────────────────────────────────────
TOTAL SECURITY SCORE    ${"█".repeat(Math.round(overallScore.total / 4))} ${
      overallScore.total
    }/100 (${overallScore.total}%)
\`\`\`

### Score Interpretation
- **90-100**: Excellent - Production ready
- **80-89**: Good - Minor improvements needed${
      overallScore.total >= 80 && overallScore.total < 90
        ? " ← **Your Score**"
        : ""
    }
- **70-79**: Fair - Some security gaps present${
      overallScore.total >= 70 && overallScore.total < 80
        ? " ← **Your Score**"
        : ""
    }
- **60-69**: Poor - Significant security issues${
      overallScore.total >= 60 && overallScore.total < 70
        ? " ← **Your Score**"
        : ""
    }
- **<60**: Critical - Immediate action required${
      overallScore.total < 60 ? " ← **Your Score**" : ""
    }

---

## 📋 Tool Versions & Configuration

| Tool        | Version | Status     | Purpose                    |
| ----------- | ------- | ---------- | -------------------------- |
${tools
  .map(
    (tool) =>
      `| ${tool.tool} | ${tool.version || "Latest"} | ${this.getStatusEmoji(
        tool.status
      )} ${tool.status} | ${this.getToolPurpose(tool.tool)} |`
  )
  .join("\n")}

---

_Report generated by Vibe Security CLI v${metadata.vibeVersion}_  
_Scan completed on ${metadata.scanDate} at ${metadata.scanTime}_
`;
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case "SUCCESS":
      case "EXCELLENT":
      case "BONUS":
        return "✅";
      case "GOOD":
        return "⚠️";
      case "FAILED":
        return "❌";
      case "SKIPPED":
        return "⏭️";
      default:
        return "❓";
    }
  }

  private getStatusDescription(status: string): string {
    switch (status) {
      case "EXCELLENT":
        return "No issues found";
      case "GOOD":
        return "Minor issues or missing coverage";
      case "FAILED":
        return "Tool failed or not available";
      case "BONUS":
        return "Exceptional tool coverage";
      default:
        return "Unknown status";
    }
  }

  private generateToolSection(tool: ScanResult): string {
    const status =
      tool.status === "SUCCESS"
        ? "✅ **PASSED**"
        : tool.status === "FAILED"
        ? "❌ **FAILED**"
        : "⏭️ **SKIPPED**";

    return `### ${
      tool.tool.charAt(0).toUpperCase() + tool.tool.slice(1)
    } Security Scan

**Tool**: ${tool.tool} ${tool.version ? `v${tool.version}` : ""}  
**Status**: ${status}  
**Findings**: ${tool.findings} issues detected

${tool.error ? `**Error**: ${tool.error}` : ""}
${tool.executionTime ? `**Execution Time**: ${tool.executionTime}ms` : ""}`;
  }

  private generateStrengths(tools: ScanResult[]): string {
    const strengths = [];
    const successfulTools = tools.filter((t) => t.status === "SUCCESS");

    if (successfulTools.length > 0) {
      strengths.push(
        `**${successfulTools.length} tools operational**: Comprehensive security coverage`
      );
    }

    const zeroFindingTools = successfulTools.filter((t) => t.findings === 0);
    if (zeroFindingTools.length > 0) {
      strengths.push(
        `**Clean security posture**: No vulnerabilities detected by ${zeroFindingTools.length} tools`
      );
    }

    return strengths.map((s) => `- ${s}`).join("\n");
  }

  private generateImprovements(tools: ScanResult[]): string {
    const improvements = [];
    const failedTools = tools.filter((t) => t.status === "FAILED");
    const skippedTools = tools.filter((t) => t.status === "SKIPPED");

    if (failedTools.length > 0) {
      improvements.push(
        `**Fix tool installations**: ${failedTools
          .map((t) => t.tool)
          .join(", ")} need to be installed`
      );
    }

    if (skippedTools.length > 0) {
      improvements.push(
        `**Enable skipped scans**: ${skippedTools
          .map((t) => t.tool)
          .join(", ")} were not executed`
      );
    }

    return improvements.map((i) => `- ${i}`).join("\n");
  }

  private getToolPurpose(tool: string): string {
    const purposes: Record<string, string> = {
      semgrep: "Static code analysis",
      gitleaks: "Secret detection",
      trivy: "Vulnerability scanning",
      "osv-scanner": "Dependency vulnerabilities",
      docker: "Container runtime",
      zap: "Web security testing",
    };
    return purposes[tool] || "Security scanning";
  }

  private parseAiAnalysis() {
    try {
      const summaryPath = path.join(this.artifactsDir, "ai", "summary.md");
      if (!fs.existsSync(summaryPath)) {
        return undefined;
      }

      const summaryContent = fs.readFileSync(summaryPath, "utf-8");

      // Parse the AI summary to extract structured data
      const summary = summaryContent.replace(/"/g, "").trim();

      // Extract priorities
      const priorities: Array<{
        level: "P0" | "P1" | "P2";
        description: string;
      }> = [];
      const priorityMatches =
        summary.match(/- \*\*(P[012])\*\*: ([^\\n]+)/g) || [];

      for (const match of priorityMatches) {
        const [, level, description] =
          match.match(/\*\*(P[012])\*\*: (.+)/) || [];
        if (level && description) {
          priorities.push({
            level: level as "P0" | "P1" | "P2",
            description: description.trim(),
          });
        }
      }

      // Extract recommendations
      const recommendationsMatch = summary.match(
        /## Recommendations\s*\n([\s\S]*?)(?:\n##|$)/
      );
      const recommendations: string[] = [];

      if (recommendationsMatch) {
        const recText = recommendationsMatch[1];
        const recMatches = recText.match(/- ([^\\n]+)/g) || [];
        for (const recMatch of recMatches) {
          const rec = recMatch.replace(/^- /, "").trim();
          if (rec) recommendations.push(rec);
        }
      }

      // Count critical issues (P0 priorities) - keep for backward compatibility
      const criticalIssues = priorities.filter((p) => p.level === "P0").length;

      return {
        summary: summary.split("## Priorities")[0].trim(),
        priorities,
        recommendations,
        criticalIssues,
      };
    } catch (error) {
      console.warn("Failed to parse AI analysis:", error);
      return undefined;
    }
  }

  private generateUiTestingSection(
    uiTesting: NonNullable<SecurityReport["uiTesting"]>
  ): string {
    const { summary } = uiTesting;
    const successRate =
      summary.total > 0
        ? Math.round((summary.passed / summary.total) * 100)
        : 0;

    return `
### 🎭 UI Testing Results

**Status**: ${
      uiTesting.status === "PASSED" ? "✅ **PASSED**" : "❌ **FAILED**"
    }  
**Test Coverage**: ${summary.total} tests generated (${
      summary.passed
    } passed, ${summary.failed} failed)  
**Success Rate**: ${successRate}%  
**Execution Time**: ${Math.round(uiTesting.executionTime / 1000)}s

#### 📊 Test Breakdown
- **✅ Passed**: ${summary.passed} tests
- **❌ Failed**: ${summary.failed} tests
- **⏭️ Skipped**: ${summary.skipped} tests

${
  summary.failed > 0
    ? `
#### ⚠️ Failed Tests
The failed tests indicate potential issues with:
- Application availability (server not running)
- UI element selectors
- Expected behaviors
- Authentication flows

**Recommendation**: Review failed tests and ensure the application is running during testing.
`
    : `
#### 🎉 All Tests Passed!
Your UI is working as expected according to the generated test scenarios.
`
}
`;
  }

  private generateAiSection(
    aiAnalysis: NonNullable<SecurityReport["aiAnalysis"]>
  ): string {
    return `
### 🤖 AI Security Analysis

  **Status**: ${
    aiAnalysis.priorities.length > 0
      ? aiAnalysis.criticalIssues > 0
        ? "🚨 **CRITICAL ISSUES FOUND**"
        : "⚠️ **SECURITY ISSUES FOUND**"
      : "✅ **ANALYSIS COMPLETE**"
  }  
**Total Issues**: ${aiAnalysis.priorities.length} (${
      aiAnalysis.criticalIssues
    } critical)

#### 📋 Summary
${aiAnalysis.summary}

#### 🎯 Priority Issues
${aiAnalysis.priorities
  .map((p) => `- **${p.level}**: ${p.description}`)
  .join("\n")}

#### 💡 AI Recommendations
${aiAnalysis.recommendations.map((rec) => `- ${rec}`).join("\n")}
`;
  }

  private generateAiUsageSection(
    aiUsage: NonNullable<SecurityReport["aiUsage"]>
  ): string {
    const formatNumber = (num: number) => num.toLocaleString();

    return `
### 📊 AI Usage Summary

**Total API Calls**: ${formatNumber(aiUsage.totalCalls)}  
**Total Tokens**: ${formatNumber(aiUsage.totalTokens)}  
**Input Tokens**: ${formatNumber(aiUsage.promptTokens)}  
**Output Tokens**: ${formatNumber(aiUsage.completionTokens)}  
${
  aiUsage.totalCost
    ? `**Estimated Cost**: $${aiUsage.totalCost.toFixed(4)}`
    : ""
}

This analysis utilized AI to generate security insights, test scenarios, and recommendations.
`;
  }
}
