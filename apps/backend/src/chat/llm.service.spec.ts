import { GroqProvider } from "./providers/groq.provider";
import {
  LlmProvider,
  LlmProviderError,
  LlmResult,
} from "./providers/llm-provider";
import { LocalProvider } from "./providers/local.provider";
import { LlmService } from "./llm.service";

const result = (provider: string): LlmResult => ({
  text: "grounded answer",
  provider,
  model: "test",
  inputTokens: 10,
  outputTokens: 5,
  estimatedCostUsd: 0,
});

describe("LLM provider fallback", () => {
  it("falls back after a configured provider is rate limited", async () => {
    const primary: LlmProvider = {
      name: "primary",
      isConfigured: () => true,
      generate: async () => {
        throw new LlmProviderError("primary", "rate limited", 429, "30");
      },
    };
    const local: LlmProvider = {
      name: "local",
      isConfigured: () => true,
      generate: async () => result("local"),
    };
    const service = new LlmService(
      primary as GroqProvider,
      local as LocalProvider,
    );
    await expect(service.answer("question", [])).resolves.toMatchObject({
      provider: "local",
      fallbackReasons: ["primary: rate limited | 429 | 30"],
    });
  });

  it("skips providers that are not configured", async () => {
    const primary: LlmProvider = {
      name: "primary",
      isConfigured: () => false,
      generate: jest.fn(async () => result("primary")),
    };
    const local: LlmProvider = {
      name: "local",
      isConfigured: () => true,
      generate: async () => result("local"),
    };
    const service = new LlmService(
      primary as GroqProvider,
      local as LocalProvider,
    );
    expect((await service.answer("question", [])).provider).toBe("local");
    expect(primary.generate).not.toHaveBeenCalled();
  });
});
