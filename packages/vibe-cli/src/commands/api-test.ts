import { runDredd, runSchemathesis } from "../lib/adapters/index.js";
export default async (opts: {
  config: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
}) => {
  const YAML = await import("yaml");
  const spec = YAML.parse(
    (await import("node:fs")).readFileSync(opts.config, "utf-8")
  );
  if (!spec.apis?.openapi) return console.log("[vibe] no openapi specified");
  const base = spec.apis.baseUrl || spec.app.url + "/api";
  const c1 = await runDredd(spec.apis.openapi, base);
  const c2 = await runSchemathesis(spec.apis.openapi);
  // TODO: Add AI gap inference for API contract compliance
  if (c1 !== 0 || c2 !== 0) process.exit(10);
};
