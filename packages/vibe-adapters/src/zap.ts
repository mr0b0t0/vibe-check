import { spawn } from "node:child_process";

export function runZapBaseline(target: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(
      "docker",
      [
        "run",
        "--rm",
        "-t",
        "owasp/zap2docker-stable",
        "zap-baseline.py",
        "-t",
        target,
        "-r",
        "/zap/wrk/zap.html",
        "-d",
      ],
      { stdio: "inherit" }
    );

    p.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        console.warn(
          "[vibe][zap] Docker not found. Install Docker to use OWASP ZAP scanning."
        );
        resolve(0); // Skip gracefully
      } else {
        console.error("[vibe][zap] Error:", err.message);
        resolve(1);
      }
    });

    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
