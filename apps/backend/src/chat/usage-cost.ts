export function estimatedTokens(text: string) {
  return Math.max(0, Math.ceil(text.length / 4));
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  inputUsdPerMillion: number,
  outputUsdPerMillion: number,
) {
  const safe = (value: number) =>
    Number.isFinite(value) && value > 0 ? value : 0;
  const cost =
    (safe(inputTokens) * safe(inputUsdPerMillion) +
      safe(outputTokens) * safe(outputUsdPerMillion)) /
    1_000_000;
  return Number(cost.toFixed(6));
}

export function configuredRate(value?: string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizedTokenCount(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}
