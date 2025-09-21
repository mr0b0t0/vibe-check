import { spawn } from "node:child_process";

export function sh(
  cmd: string,
  args: string[] = [],
  opts: any = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: process.platform === "win32",
      ...opts,
    });
    let stdout = "",
      stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
