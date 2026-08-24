import rawCases from "./golden-qa.json" with { type: "json" };
import {
  EvalResponse,
  GoldenCase,
  percentage,
  scoreCase,
  validateGoldenCase,
} from "./scoring";

const api = process.env.EVAL_API_URL ?? "http://localhost:4000/api";
const token = process.env.EVAL_TOKEN;
if (!token) throw new Error("Set EVAL_TOKEN to a valid workspace JWT.");
if (!Array.isArray(rawCases) || !rawCases.every(validateGoldenCase))
  throw new Error("eval/golden-qa.json contains an invalid case.");

const headers = {
  "content-type": "application/json",
  authorization: `Bearer ${token}`,
};
const tenantResponse = await fetch(`${api}/tenants/me`, { headers });
if (!tenantResponse.ok)
  throw new Error(
    `Unable to identify eval tenant (HTTP ${tenantResponse.status}).`,
  );
const tenant = (await tenantResponse.json()) as { slug: string };
const cases = (rawCases as GoldenCase[]).filter(
  (test) => test.tenant === tenant.slug,
);
if (!cases.length)
  throw new Error(`No golden cases found for tenant '${tenant.slug}'.`);

const results = [];
for (const test of cases) {
  const response = await fetch(`${api}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: test.question }),
  });
  if (!response.ok) {
    const result = {
      question: test.question,
      passed: false,
      retrievalPassed: false,
      answerPassed: false,
      error: `HTTP ${response.status}`,
    };
    results.push(result);
    console.log(`FAIL ${test.question} — ${result.error}`);
    continue;
  }
  const score = scoreCase(test, (await response.json()) as EvalResponse);
  results.push({ question: test.question, ...score });
  console.log(
    `${score.passed ? "PASS" : "FAIL"} ${test.question} — retrieval=${score.retrievalPassed ? "pass" : "fail"} (${score.citationCount} citations, ${score.matchedSources}/${score.expectedSources} expected sources), answer=${score.answerPassed ? "pass" : "fail"} (${score.matchedKeywords}/${score.expectedKeywords} keywords)`,
  );
}

const retrievalPassed = results.filter(
  (result) => result.retrievalPassed,
).length;
const answerPassed = results.filter((result) => result.answerPassed).length;
const passed = results.filter((result) => result.passed).length;
const report = {
  tenant: tenant.slug,
  evaluated: results.length,
  skipped: rawCases.length - results.length,
  retrievalHitRate: percentage(retrievalPassed, results.length),
  answerAccuracy: percentage(answerPassed, results.length),
  overallPassRate: percentage(passed, results.length),
  passed,
  results,
};

console.log(
  `\nRetrieval hit rate: ${report.retrievalHitRate}%\nAnswer accuracy: ${report.answerAccuracy}%\nOverall: ${passed}/${results.length} (${report.overallPassRate}%)`,
);
console.log(`EVAL_REPORT_JSON=${JSON.stringify(report)}`);
process.exitCode = passed === results.length ? 0 : 1;
