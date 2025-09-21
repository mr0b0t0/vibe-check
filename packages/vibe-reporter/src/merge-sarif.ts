import fs from "node:fs";

export async function mergeSarif(paths: string[]) {
  const reports = paths
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf-8")));
  if (reports.length === 0) return { version: "2.1.0", runs: [] };
  // naive merge: concat runs
  return { version: "2.1.0", runs: reports.flatMap((r: any) => r.runs || []) };
}
