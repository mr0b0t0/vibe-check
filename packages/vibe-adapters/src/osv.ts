import { spawn } from "node:child_process";

export function runOSV(): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(
      "osv-scanner",
      ["--recursive", "--format=json", "--output", ".vibe/osv.json", "."],
      { stdio: "inherit" }
    );

    p.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        console.warn(
          "[vibe][osv] Tool not found. Install with: go install github.com/google/osv-scanner/cmd/osv-scanner@latest"
        );
        resolve(0); // Skip gracefully
      } else {
        console.error("[vibe][osv] Error:", err.message);
        resolve(1);
      }
    });

    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
