import { Hit } from "../../retrieval/retrieval.service";

export type LlmRequest = {
  question: string;
  hits: Hit[];
  onToken?: (token: string) => void | Promise<void>;
};

export type LlmResult = {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  fallbackReasons?: string[];
};

export interface LlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  generate(request: LlmRequest): Promise<LlmResult>;
}

export class LlmProviderError extends Error {
  constructor(
    provider: string,
    message: string,
    readonly status?: number,
    readonly retryAfter?: string,
  ) {
    super(`${provider}: ${message}`);
    this.name = "LlmProviderError";
  }
}

export function requestContext(hits: Hit[]) {
  return hits
    .slice(0, 3)
    .map((hit) => hit.content)
    .join("\n\n");
}
