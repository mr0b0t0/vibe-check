import fs from "node:fs";
export function renderMarkdownSummary() {
  const md = `# Vibe Report\n\nArtifacts in .vibe/ (SARIF, screenshots, traces).`;
  fs.writeFileSync(".vibe/report.md", md);
}
