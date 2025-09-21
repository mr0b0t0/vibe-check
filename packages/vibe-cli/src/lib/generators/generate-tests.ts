import fs from "fs-extra";
import path from "node:path";
import { VibeSpec } from "@vibe/spec";
import { emitLoginHelper } from "./login.js";

export async function generateTests(spec: VibeSpec, outDir: string) {
  const files: string[] = [];
  await fs.ensureDir(outDir);
  await fs.writeFile(path.join(outDir, "test-setup.ts"), emitLoginHelper());

  for (const mod of spec.modules) {
    const body: string[] = [];
    body.push(`import { test, expect } from './test-setup';`);
    body.push(`test.describe('${mod.id}', () => {`);
    for (const page of mod.pages) {
      if (!page.flows) continue;
      for (const flow of page.flows) {
        body.push(`  test('${flow.name}', async ({ page }) => {`);
        body.push(`    await page.goto('${page.path}');`);
        for (const step of flow.steps) {
          if (step.goto) body.push(`    await page.goto('${step.goto}');`);
          if (step.fill) {
            for (const [sel, val] of Object.entries(step.fill)) {
              body.push(
                `    await page.fill(${JSON.stringify(sel)}, ${JSON.stringify(
                  val
                )});`
              );
            }
          }
          if (step.click)
            body.push(`    await page.click(${JSON.stringify(step.click)});`);
          if (step.expectUrl)
            body.push(
              `    await expect(page).toHaveURL(/${step.expectUrl.replace(
                /\//g,
                "\\/"
              )}/);`
            );
          if (step.expectText)
            body.push(
              `    await expect(page.locator('body')).toContainText(${JSON.stringify(
                step.expectText
              )});`
            );
          if (step.expectVisible)
            body.push(
              `    await expect(page.locator(${JSON.stringify(
                step.expectVisible
              )})).toBeVisible();`
            );
        }
        body.push(`  });`);
      }
    }
    body.push(`});`);
    const file = path.join(outDir, `${mod.id}.spec.ts`);
    await fs.writeFile(file, body.join("\n"));
    files.push(file);
  }
  return files;
}
