import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { AiClient } from "../types.js";

export class AnthropicClient implements AiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateObject<T>(opts: {
    schemaName: string;
    system: string;
    user: string;
    model: string;
    temperature: number;
    maxTokens: number;
    schema: any;
  }): Promise<{ object: T; usage: any; finishReason: string }> {
    try {
      const anthropicProvider = createAnthropic({ apiKey: this.apiKey });
      const result = await generateObject({
        model: anthropicProvider(opts.model),
        system: opts.system,
        prompt: opts.user,
        schema: opts.schema,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });

      return {
        object: result.object as T,
        usage: result.usage,
        finishReason: result.finishReason,
      };
    } catch (error) {
      console.error(`[vibe][ai] Anthropic error:`, error);
      throw error;
    }
  }
}
