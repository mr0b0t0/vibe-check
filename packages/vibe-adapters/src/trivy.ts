import { spawn } from "node:child_process";

export function runTrivyRepo(): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(
      "trivy",
      ["repo", "--format", "sarif", "-o", ".vibe/trivy.sarif", "."],
      { stdio: "inherit" }
    );

    p.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        console.warn(
          "[vibe][trivy] Tool not found. Install with: brew install trivy"
        );
        resolve(0); // Skip gracefully
      } else {
        console.error("[vibe][trivy] Error:", err.message);
        resolve(1);
      }
    });

    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
