import { spawn } from "node:child_process";

export function runGitleaks(): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(
      "gitleaks",
      [
        "detect",
        "--report-format=json",
        "--report-path",
        ".vibe/gitleaks.json",
      ],
      { stdio: "inherit" }
    );

    p.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        console.warn(
          "[vibe][gitleaks] Tool not found. Install with: brew install gitleaks"
        );
        resolve(0); // Skip gracefully
      } else {
        console.error("[vibe][gitleaks] Error:", err.message);
        resolve(1);
      }
    });

    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
