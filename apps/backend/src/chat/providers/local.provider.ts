import { Injectable } from "@nestjs/common";
import { estimatedTokens } from "../usage-cost";
import {
  LlmProvider,
  LlmRequest,
  LlmResult,
  requestContext,
} from "./llm-provider";

@Injectable()
export class LocalProvider implements LlmProvider {
  readonly name = "local";

  isConfigured() {
    return true;
  }

  async generate({ question, hits, onToken }: LlmRequest): Promise<LlmResult> {
    const context = requestContext(hits);
    const text = context
      ? context.slice(0, 3000)
      : "I could not find relevant information in this workspace.";
    if (onToken) for (const token of text.split(/(\s+)/)) await onToken(token);
    return {
      text,
      provider: this.name,
      model: "extractive-fallback",
      inputTokens: estimatedTokens(question + context),
      outputTokens: estimatedTokens(text),
      estimatedCostUsd: 0,
    };
  }
}
