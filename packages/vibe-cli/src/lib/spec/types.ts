import { z } from "zod";

export const VibeSchema = z.object({
  version: z.string().optional(),
  ai: z
    .object({
      enabled: z.boolean().default(true),
      provider: z
        .enum(["openai", "anthropic", "google", "xai", "custom"])
        .default("openai"),
      model: z.string().default("gpt-4"),
      temperature: z.number().min(0).max(2).default(0.2),
      maxTokens: z.number().positive().default(4000),
      redact: z
        .object({
          globs: z
            .array(z.string())
            .default(["**/.env*", "**/*.pem", "**/secrets/**"]),
          patterns: z
            .array(z.string())
            .default(["AKIA[0-9A-Z]{16}", "-----BEGIN PRIVATE KEY-----"]),
        })
        .optional(),
      include: z
        .object({
          globs: z
            .array(z.string())
            .default(["app/**/*", "pages/**/*", "src/**/*.{ts,tsx,js,jsx}"]),
        })
        .optional(),
      chunking: z
        .object({
          maxCharsPerChunk: z.number().positive().default(20000),
          overlap: z.number().nonnegative().default(512),
        })
        .optional(),
      limits: z
        .object({
          maxFiles: z.number().positive().default(800),
          maxTotalChars: z.number().positive().default(3000000),
        })
        .optional(),
      testGen: z
        .object({
          preferDataTestId: z.boolean().default(true),
          defaultWaitMs: z.number().nonnegative().default(200),
        })
        .optional(),
      thresholds: z
        .object({
          aiCriticalToFail: z.boolean().default(true),
          treatLowConfidenceAsInfo: z.boolean().default(true),
        })
        .optional(),
    })
    .optional(),
  app: z.object({
    start: z.string().optional(),
    dockerCompose: z.string().optional(),
    url: z.string(),
    healthcheck: z
      .object({
        path: z.string().optional(),
        status: z.number().optional(),
        timeoutSec: z.number().optional(),
      })
      .optional(),
    env: z.record(z.string()).optional(),
  }),
  auth: z
    .object({
      strategy: z
        .enum(["none", "credentials", "oauth", "jwt", "custom"])
        .optional(),
      testUsers: z
        .array(
          z.object({
            role: z.string(),
            email: z.string().optional(),
            password: z.string().optional(),
            token: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  modules: z.array(
    z.object({
      id: z.string(),
      description: z.string().optional(),
      pages: z.array(
        z.object({
          path: z.string(),
          requiresRole: z.string().optional(),
          shouldContain: z.array(z.string()).optional(),
          shouldNotContain: z.array(z.string()).optional(),
          flows: z
            .array(
              z.object({
                name: z.string(),
                asRole: z.string().optional(),
                steps: z.array(z.record(z.any())),
              })
            )
            .optional(),
        })
      ),
    })
  ),
  apis: z
    .object({
      openapi: z.string().optional(),
      graphql: z.string().optional(),
      baseUrl: z.string().optional(),
    })
    .optional(),
  scanners: z.record(z.any()).optional(),
  reporting: z.record(z.any()).optional(),
});

export type VibeSpec = z.infer<typeof VibeSchema>;
