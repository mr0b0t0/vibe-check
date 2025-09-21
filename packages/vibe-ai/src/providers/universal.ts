import { generateObject, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { AiClient, Provider } from "../types.js";

export class UniversalAiClient implements AiClient {
  private provider: Provider;
  private apiKey?: string;
  private baseURL?: string;

  constructor(provider: Provider, apiKey?: string, baseURL?: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseURL = baseURL;
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
    const model = this.getModel(opts.model);

    try {
      const result = await generateObject({
        model: model as unknown as LanguageModel,
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
      console.error(`[vibe][ai] ${this.provider} error:`, error);
      throw error;
    }
  }

  private getModel(modelName: string) {
    switch (this.provider) {
      case "openai":
        const openaiProvider = createOpenAI({
          apiKey: this.apiKey || process.env.OPENAI_API_KEY,
          baseURL: this.baseURL,
        });
        return openaiProvider(modelName);
      case "anthropic":
        const anthropicProvider = createAnthropic({
          apiKey: this.apiKey || process.env.ANTHROPIC_API_KEY,
          baseURL: this.baseURL,
        });
        return anthropicProvider(modelName);
      case "google":
        const googleProvider = createGoogleGenerativeAI({
          apiKey: this.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
          baseURL: this.baseURL,
        });
        return googleProvider(modelName);
      case "xai":
        return createXai({
          apiKey: this.apiKey || process.env.XAI_API_KEY,
          baseURL: this.baseURL,
        })(modelName);
      case "custom":
        if (!this.baseURL) {
          throw new Error("Custom provider requires baseURL");
        }
        const customProvider = createOpenAI({
          apiKey: this.apiKey || process.env.CUSTOM_API_KEY,
          baseURL: this.baseURL,
        });
        return customProvider(modelName);
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }
}
