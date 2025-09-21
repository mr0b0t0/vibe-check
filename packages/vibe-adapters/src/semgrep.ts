import { spawn } from "node:child_process";

export function runSemgrep(): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(
      "semgrep",
      ["scan", "--config", "p/ci", "--json", "--output", ".vibe/semgrep.json"],
      { stdio: "inherit" }
    );

    p.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        console.warn(
          "[vibe][semgrep] Tool not found. Install with: pip install semgrep or brew install semgrep"
        );
        resolve(0); // Skip gracefully
      } else {
        console.error("[vibe][semgrep] Error:", err.message);
        resolve(1);
      }
    });

    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
