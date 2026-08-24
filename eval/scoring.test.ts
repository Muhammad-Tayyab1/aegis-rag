import assert from "node:assert/strict";
import test from "node:test";
import { percentage, scoreCase, validateGoldenCase } from "./scoring";

test("scores retrieval sources separately from answer keywords", () => {
  const score = scoreCase(
    {
      tenant: "aegis-demo",
      question: "What is IPC-104?",
      expectedKeywords: ["isolation", "incident"],
      expectedSources: ["hospital-policy.md"],
    },
    {
      answer: "Report the isolation incident.",
      citations: [{ document: "hospital-policy.md" }],
    },
  );
  assert.equal(score.retrievalPassed, true);
  assert.equal(score.answerPassed, true);
  assert.equal(score.passed, true);
});

test("fails retrieval when the expected source is absent", () => {
  const score = scoreCase(
    {
      tenant: "aegis-demo",
      question: "Question",
      expectedKeywords: ["answer"],
      expectedSources: ["expected.pdf"],
    },
    { answer: "answer", citations: [{ document: "other.pdf" }] },
  );
  assert.equal(score.retrievalPassed, false);
  assert.equal(score.answerPassed, true);
});

test("validates cases and calculates stable empty percentages", () => {
  assert.equal(
    validateGoldenCase({
      tenant: "tenant",
      question: "question",
      expectedKeywords: ["keyword"],
    }),
    true,
  );
  assert.equal(validateGoldenCase({ question: "missing fields" }), false);
  assert.equal(percentage(0, 0), 0);
  assert.equal(percentage(2, 3), 67);
});
