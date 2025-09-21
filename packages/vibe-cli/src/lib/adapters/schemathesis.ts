import { spawn } from "node:child_process";
export function runSchemathesis(openapiPath: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn("schemathesis", ["run", "--checks", "all", openapiPath], {
      stdio: "inherit",
    });
    p.on("close", (code: number | null) => resolve(code ?? 1));
  });
}
