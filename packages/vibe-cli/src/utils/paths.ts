import path from "node:path";
export const artifactsDir = (cwd = process.cwd()) => path.join(cwd, ".vibe");
