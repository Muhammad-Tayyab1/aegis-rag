import {
  configuredRate,
  estimateCostUsd,
  estimatedTokens,
  normalizedTokenCount,
} from "./usage-cost";

describe("query cost metering", () => {
  it("calculates input and output cost per million tokens", () => {
    expect(estimateCostUsd(1_000_000, 500_000, 0.2, 0.8)).toBe(0.6);
    expect(estimateCostUsd(1000, 500, 0.2, 0.8)).toBe(0.0006);
  });

  it("keeps free and invalid rates at zero", () => {
    expect(estimateCostUsd(1000, 1000, 0, 0)).toBe(0);
    expect(configuredRate("invalid")).toBe(0);
    expect(configuredRate("-1")).toBe(0);
  });

  it("uses a stable local token estimate", () => {
    expect(estimatedTokens("12345678")).toBe(2);
    expect(estimatedTokens("")).toBe(0);
  });

  it("normalizes provider token counts", () => {
    expect(normalizedTokenCount("42", 10)).toBe(42);
    expect(normalizedTokenCount("invalid", 10)).toBe(10);
    expect(normalizedTokenCount(-1, 10)).toBe(10);
  });
});
