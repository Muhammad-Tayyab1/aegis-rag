import { Injectable } from "@nestjs/common";
import { Hit } from "../retrieval/retrieval.service";
import { GroqProvider } from "./providers/groq.provider";
import { LlmProvider, LlmProviderError } from "./providers/llm-provider";
import { LocalProvider } from "./providers/local.provider";

@Injectable()
export class LlmService {
  private readonly providers: LlmProvider[];

  constructor(groq: GroqProvider, local: LocalProvider) {
    this.providers = [groq, local];
  }

  async answer(
    question: string,
    hits: Hit[],
    onToken?: (token: string) => void | Promise<void>,
  ) {
    const fallbackReasons: string[] = [];
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      try {
        return {
          ...(await provider.generate({ question, hits, onToken })),
          fallbackReasons,
        };
      } catch (error) {
        const detail =
          error instanceof LlmProviderError
            ? [error.message, error.status, error.retryAfter]
                .filter(Boolean)
                .join(" | ")
            : `${provider.name}: unexpected provider failure`;
        fallbackReasons.push(detail);
      }
    }
    throw new Error("No LLM provider could produce an answer");
  }
}
