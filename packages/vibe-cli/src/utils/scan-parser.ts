import fs from "node:fs";
import path from "node:path";

export interface ParsedFindings {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export class ScanParser {
  private artifactsDir: string;

  constructor(artifactsDir: string) {
    this.artifactsDir = artifactsDir;
  }

  parseSemgrepResults(): ParsedFindings {
    const semgrepFile = path.join(this.artifactsDir, "semgrep.json");

    if (!fs.existsSync(semgrepFile)) {
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }

    try {
      const data = JSON.parse(fs.readFileSync(semgrepFile, "utf-8"));
      const results = data.results || [];

      let critical = 0,
        high = 0,
        medium = 0,
        low = 0,
        info = 0;

      for (const result of results) {
        const severity = result.extra?.severity?.toLowerCase();
        switch (severity) {
          case "error":
          case "critical":
            critical++;
            break;
          case "warning":
          case "high":
            high++;
            break;
          case "medium":
            medium++;
            break;
          case "low":
            low++;
            break;
          default:
            info++;
        }
      }

      return {
        total: results.length,
        critical,
        high,
        medium,
        low,
        info,
      };
    } catch (error) {
      console.warn("Failed to parse semgrep results:", error);
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }
  }

  parseGitleaksResults(): ParsedFindings {
    const gitleaksFile = path.join(this.artifactsDir, "gitleaks.json");

    if (!fs.existsSync(gitleaksFile)) {
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }

    try {
      const data = JSON.parse(fs.readFileSync(gitleaksFile, "utf-8"));
      const results = Array.isArray(data) ? data : [];

      // All secret findings are considered high severity
      return {
        total: results.length,
        critical: 0,
        high: results.length,
        medium: 0,
        low: 0,
        info: 0,
      };
    } catch (error) {
      console.warn("Failed to parse gitleaks results:", error);
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }
  }

  parseOsvResults(): ParsedFindings {
    const osvFile = path.join(this.artifactsDir, "osv.json");

    if (!fs.existsSync(osvFile)) {
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }

    try {
      const data = JSON.parse(fs.readFileSync(osvFile, "utf-8"));
      const vulnerabilities =
        data.results?.[0]?.packages?.[0]?.vulnerabilities || [];

      let critical = 0,
        high = 0,
        medium = 0,
        low = 0,
        info = 0;

      for (const vuln of vulnerabilities) {
        const severity = vuln.severity?.[0]?.severity?.toLowerCase();
        switch (severity) {
          case "critical":
            critical++;
            break;
          case "high":
            high++;
            break;
          case "medium":
            medium++;
            break;
          case "low":
            low++;
            break;
          default:
            info++;
        }
      }

      return {
        total: vulnerabilities.length,
        critical,
        high,
        medium,
        low,
        info,
      };
    } catch (error) {
      console.warn("Failed to parse OSV results:", error);
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }
  }

  parseTrivyResults(): ParsedFindings {
    const trivyFile = path.join(this.artifactsDir, "trivy.sarif");

    if (!fs.existsSync(trivyFile)) {
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }

    try {
      const data = JSON.parse(fs.readFileSync(trivyFile, "utf-8"));
      const results = data.runs?.[0]?.results || [];

      let critical = 0,
        high = 0,
        medium = 0,
        low = 0,
        info = 0;

      for (const result of results) {
        const level = result.level?.toLowerCase();
        switch (level) {
          case "error":
            critical++;
            break;
          case "warning":
            high++;
            break;
          case "note":
            medium++;
            break;
          case "info":
            info++;
            break;
          default:
            low++;
        }
      }

      return {
        total: results.length,
        critical,
        high,
        medium,
        low,
        info,
      };
    } catch (error) {
      console.warn("Failed to parse trivy results:", error);
      return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    }
  }

  getToolVersion(tool: string): string | undefined {
    try {
      switch (tool) {
        case "semgrep": {
          const semgrepFile = path.join(this.artifactsDir, "semgrep.json");
          if (fs.existsSync(semgrepFile)) {
            const data = JSON.parse(fs.readFileSync(semgrepFile, "utf-8"));
            return data.version;
          }
          break;
        }
        case "trivy": {
          const trivyFile = path.join(this.artifactsDir, "trivy.sarif");
          if (fs.existsSync(trivyFile)) {
            const data = JSON.parse(fs.readFileSync(trivyFile, "utf-8"));
            return data.runs?.[0]?.tool?.driver?.version;
          }
          break;
        }
      }
    } catch (error) {
      // Ignore parsing errors for version detection
    }
    return undefined;
  }

  aggregateFindings(): ParsedFindings {
    const semgrep = this.parseSemgrepResults();
    const gitleaks = this.parseGitleaksResults();
    const trivy = this.parseTrivyResults();
    const osv = this.parseOsvResults();

    return {
      total: semgrep.total + gitleaks.total + trivy.total + osv.total,
      critical:
        semgrep.critical + gitleaks.critical + trivy.critical + osv.critical,
      high: semgrep.high + gitleaks.high + trivy.high + osv.high,
      medium: semgrep.medium + gitleaks.medium + trivy.medium + osv.medium,
      low: semgrep.low + gitleaks.low + trivy.low + osv.low,
      info: semgrep.info + gitleaks.info + trivy.info + osv.info,
    };
  }
}
