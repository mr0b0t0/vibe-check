import { readFileSync } from "node:fs";
import { artifactsDir } from "../utils/paths.js";
import { waitForHttp } from "../utils/http.js";
import { writeFileSync, mkdirSync } from "node:fs";

export default async ({ config }: { config: string }) => {
  const YAML = await import("yaml");
  const spec = YAML.parse(readFileSync(config, "utf-8"));
  const url: string = spec.app.url;
  const start: string | undefined = spec.app.start;
  const art = artifactsDir();
  mkdirSync(art, { recursive: true });

  if (start) {
    // naive boot: run in background via shell & rely on user to stop
    const { sh } = await import("../utils/exec.js");
    console.log(`[vibe] starting app: ${start}`);
    sh(start, [], { stdio: "inherit", detached: true });
  }
  const health = spec.app.healthcheck?.path || "/";
  const timeoutSec = spec.app.healthcheck?.timeoutSec || 30;
  await waitForHttp(url + health, { timeoutMs: timeoutSec * 1000 });
  writeFileSync(`${art}/app.json`, JSON.stringify({ url }, null, 2));
  console.log("[vibe] app is up");
};
