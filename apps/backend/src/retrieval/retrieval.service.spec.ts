import { embed, markReranked } from "./retrieval.service";
describe("embedding fallback", () => {
  it("returns a deterministic normalized 384-dimensional vector", () => {
    const a = embed("Aegis policy");
    expect(a).toHaveLength(384);
    expect(embed("Aegis policy")).toEqual(a);
    expect(Math.abs(Math.hypot(...a) - 1)).toBeLessThan(1e-6);
  });
  it("changes with input text", () => {
    expect(embed("one")).not.toEqual(embed("two"));
  });
  it("rejects unsupported model identifiers", () => {
    expect(() => embed("one", "all-MiniLM-L6-v2")).toThrow(
      "Unsupported embedding model: all-MiniLM-L6-v2",
    );
  });
});

describe("retrieval trace provenance", () => {
  it("adds rerank only when reranking actually executes", () => {
    const hit = {
      id: "chunk",
      documentId: "document",
      filename: "policy.md",
      content: "policy",
      score: 0.5,
      rank: 3,
      stages: ["keyword", "fusion"],
      stageScores: { keyword: 0.6, fusion: 0.03 },
      stageRanks: { keyword: 2, fusion: 1 },
      stageLatencies: { keyword: 2, fusion: 1 },
    };
    expect(markReranked(hit, 7)).toMatchObject({
      stages: ["keyword", "fusion", "rerank"],
      stageScores: { keyword: 0.6, fusion: 0.03, rerank: 0.5 },
      stageRanks: { keyword: 2, fusion: 1, rerank: 3 },
      stageLatencies: { keyword: 2, fusion: 1, rerank: 7 },
    });
    expect(markReranked(markReranked(hit, 7), 8).stages).toEqual([
      "keyword",
      "fusion",
      "rerank",
    ]);
  });
});
