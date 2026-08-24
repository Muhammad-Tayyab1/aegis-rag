export type GoldenCase = {
  tenant: string;
  question: string;
  expectedKeywords: string[];
  expectedSources?: string[];
};

export type EvalResponse = {
  answer: string;
  citations: Array<{ document?: string }>;
};

export function validateGoldenCase(value: unknown): value is GoldenCase {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.tenant === "string" &&
    typeof item.question === "string" &&
    Array.isArray(item.expectedKeywords) &&
    item.expectedKeywords.length > 0 &&
    item.expectedKeywords.every((keyword) => typeof keyword === "string") &&
    (item.expectedSources === undefined ||
      (Array.isArray(item.expectedSources) &&
        item.expectedSources.every((source) => typeof source === "string")))
  );
}

export function scoreCase(test: GoldenCase, response: EvalResponse) {
  const answer = response.answer.toLowerCase();
  const matchedKeywords = test.expectedKeywords.filter((keyword) =>
    answer.includes(keyword.toLowerCase()),
  );
  const expectedSources = test.expectedSources ?? [];
  const matchedSources = expectedSources.filter((source) =>
    response.citations.some((citation) =>
      citation.document?.toLowerCase().includes(source.toLowerCase()),
    ),
  );
  const retrievalPassed =
    response.citations.length > 0 &&
    matchedSources.length === expectedSources.length;
  const answerPassed = matchedKeywords.length === test.expectedKeywords.length;
  return {
    passed: retrievalPassed && answerPassed,
    retrievalPassed,
    answerPassed,
    matchedKeywords: matchedKeywords.length,
    expectedKeywords: test.expectedKeywords.length,
    matchedSources: matchedSources.length,
    expectedSources: expectedSources.length,
    citationCount: response.citations.length,
  };
}

export function percentage(passed: number, total: number) {
  return total ? Math.round((passed / total) * 100) : 0;
}
