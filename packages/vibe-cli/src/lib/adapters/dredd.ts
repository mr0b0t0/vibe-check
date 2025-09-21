import { spawn } from "node:child_process";
export function runDredd(
  openapiPath: string,
  baseUrl: string
): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn("dredd", [openapiPath, baseUrl, "--reporter", "junit"], {
      stdio: "inherit",
    });
    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
