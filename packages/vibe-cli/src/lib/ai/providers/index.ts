import { Provider, AiClient } from "../types.js";
import { UniversalAiClient } from "./universal.js";

export function createAiClient(
  provider: Provider,
  apiKey?: string,
  baseURL?: string
): AiClient {
  return new UniversalAiClient(provider, apiKey, baseURL);
}
