import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  generateTests,
  ensurePlaywrightConfig,
} from "../lib/generators/index.js";
import path from "node:path";
import { initializeAi } from "../utils/ai.js";
import { checkAndInstallUiTools } from "../utils/installer.js";

export default async (opts: {
  config: string;
  noAi?: boolean;
  aiModel?: string;
  aiTemp?: number;
  aiBudgetTokens?: number;
  skipInstall?: boolean;
  autoInstall?: boolean;
  fromComprehensive?: boolean; // New flag to indicate it's called from comprehensive command
}) => {
  // Check and install Playwright
  await checkAndInstallUiTools(["playwright"], {
    skipInstall: opts.skipInstall,
    autoInstall: opts.autoInstall,
  });

  const YAML = await import("yaml");
  const spec = YAML.parse(readFileSync(opts.config, "utf-8"));
  const outDir = path.join(process.cwd(), ".vibe/tests");
  mkdirSync(outDir, { recursive: true });
  await ensurePlaywrightConfig();

  // Generate baseline tests
  const files = await generateTests(spec, outDir);

  // AI test generation
  const aiService = await initializeAi(opts.config, {
    noAi: opts.noAi,
    aiModel: opts.aiModel,
    aiTemp: opts.aiTemp,
    aiBudgetTokens: opts.aiBudgetTokens,
  });

  if (aiService) {
    console.log("[vibe][ai] Generating additional AI tests...");
    try {
      for (const module of spec.modules || []) {
        const aiTests = await aiService.generateTests(module.id, { module });
        if (aiTests?.tests?.length > 0) {
          // Generate AI test file
          const aiTestFile = path.join(outDir, `ai-${module.id}.spec.ts`);
          const testBody = [
            `import { test, expect } from './test-setup';`,
            ``,
            `test.describe('AI Generated: ${module.id}', () => {`,
          ];

          if (opts.fromComprehensive) {
            console.log(
              `  📝 Creating ${aiTests.tests.length} AI tests for ${module.id}...`
            );
          }

          for (const aiTest of aiTests.tests) {
            testBody.push(`  test('${aiTest.name}', async ({ page }) => {`);
            testBody.push(
              `    // AI generated test - priority: ${aiTest.priority}`
            );

            for (const step of aiTest.steps) {
              // Handle different action types from AI-generated tests
              switch (step.action) {
                case "goto":
                  if (step.url) {
                    testBody.push(`    await page.goto('${step.url}');`);
                  }
                  break;
                case "click":
                  if (step.selector) {
                    testBody.push(`    await page.click('${step.selector}');`);
                  }
                  break;
                case "fill":
                  if (step.selector && step.text) {
                    // Escape single quotes in text content
                    const escapedText = step.text.replace(/'/g, "\\'");
                    testBody.push(
                      `    await page.fill('${step.selector}', '${escapedText}');`
                    );
                  }
                  break;
                case "select":
                  if (step.selector && step.text) {
                    testBody.push(
                      `    await page.selectOption('${step.selector}', '${step.text}');`
                    );
                  }
                  break;
                case "wait":
                  if (step.selector) {
                    testBody.push(
                      `    await page.waitForSelector('${step.selector}');`
                    );
                  } else {
                    testBody.push(`    await page.waitForTimeout(1000);`);
                  }
                  break;
                case "expect":
                  if (step.selector && step.text) {
                    // Escape single quotes in text content
                    const escapedText = step.text.replace(/'/g, "\\'");
                    testBody.push(
                      `    await expect(page.locator('${step.selector}')).toContainText('${escapedText}');`
                    );
                  }
                  break;
                case "expectUrl":
                  if (step.url) {
                    testBody.push(
                      `    await expect(page).toHaveURL('${step.url}');`
                    );
                  }
                  break;
                default:
                  // Add a comment for unhandled actions
                  if (step.description) {
                    testBody.push(`    // ${step.description}`);
                  }
                  break;
              }
            }

            testBody.push(`  });`);
            testBody.push(``);
          }

          testBody.push(`});`);
          writeFileSync(aiTestFile, testBody.join("\n"));
          files.push(aiTestFile);

          console.log(
            `[vibe][ai] Generated ${aiTests.tests.length} additional tests for ${module.id}`
          );
        }
      }
    } catch (error) {
      console.warn("[vibe][ai] AI test generation failed:", error);
    }
  }

  writeFileSync(
    path.join(process.cwd(), ".vibe/files.json"),
    JSON.stringify(files, null, 2)
  );

  const { sh } = await import("../utils/exec.js");

  if (opts.fromComprehensive) {
    console.log("  🧪 Executing Playwright tests...");
    console.log("  📊 Test progress:");
  } else {
    console.log("\n🎭 Running Playwright tests...");
  }

  // Run tests with line reporter for user feedback
  const resultsPath = path.join(process.cwd(), ".vibe/playwright-results.json");

  const r = await sh(
    "npx",
    [
      "playwright",
      "test",
      "--reporter=line",
      `--output=${path.join(process.cwd(), ".vibe/artifacts")}`,
      "--timeout=30000",
      "--max-failures=10",
    ],
    { stdio: "inherit" }
  );

  // Capture JSON results in a separate run (only if the first run didn't completely fail)
  try {
    const jsonResult = await sh(
      "npx",
      [
        "playwright",
        "test",
        "--reporter=json",
        "--timeout=30000",
        "--max-failures=10",
      ],
      {
        stdio: ["inherit", "pipe", "inherit"],
        cwd: process.cwd(),
      }
    );

    if (jsonResult.stdout) {
      writeFileSync(resultsPath, jsonResult.stdout);
    }
  } catch (error) {
    // If JSON capture fails, create an empty results file
    writeFileSync(resultsPath, JSON.stringify({ suites: [] }));
  }

  // Read and parse the JSON results file produced by the reporter
  let results: any = null;
  try {
    const raw = readFileSync(resultsPath, "utf-8");
    results = JSON.parse(raw);
  } catch (e) {
    console.warn(
      "[vibe] Could not read Playwright JSON results from",
      resultsPath,
      e
    );
  }

  if (!opts.fromComprehensive) {
    console.log("[vibe] ui tests complete");
  }

  // Check for AI test failures
  if (aiService && r.code !== 0) {
    try {
      const aiTestFailures =
        results?.suites?.filter((s: any) => s.title?.includes("AI Generated"))
          ?.length || 0;

      if (aiTestFailures > 0 && aiService.shouldFailOnCritical()) {
        console.error(`[vibe][ai] AI-generated tests failed`);
        if (!opts.fromComprehensive) {
          process.exit(5);
        }
      }
    } catch (error) {
      console.warn("[vibe][ai] Could not analyze AI test results:", error);
    }
  }

  if (r.code !== 0 && !opts.fromComprehensive) {
    process.exit(5);
  }

  return r.code; // Return the exit code instead of exiting
};
