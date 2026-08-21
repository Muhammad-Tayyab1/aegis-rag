import cases from "./golden-qa.json" with { type: "json" };
const api = process.env.EVAL_API_URL ?? "http://localhost:4000/api";
const token = process.env.EVAL_TOKEN;
if (!token) {
  console.error("Set EVAL_TOKEN to a valid workspace JWT.");
  process.exit(1);
}
let passed = 0;
for (const test of cases) {
  const r = await fetch(`${api}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question: test.question }),
  });
  if (!r.ok) {
    console.log(`FAIL ${test.question} (HTTP ${r.status})`);
    continue;
  }
  const body = (await r.json()) as { answer: string; citations: unknown[] };
  const answer = body.answer.toLowerCase();
  const keywords = test.expectedKeywords.filter((k) => answer.includes(k));
  const ok =
    body.citations.length > 0 &&
    keywords.length === test.expectedKeywords.length;
  if (ok) passed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${test.question} — citations=${body.citations.length}, keywords=${keywords.length}/${test.expectedKeywords.length}`,
  );
}
console.log(
  `\n${passed}/${cases.length} passed (${Math.round((passed / cases.length) * 100)}%)`,
);
process.exit(passed === cases.length ? 0 : 1);
