import {
  cacheSimilarityThreshold,
  cacheTtlHours,
} from "./semantic-cache.service";

describe("semantic cache configuration", () => {
  it("uses safe defaults and bounds the similarity threshold", () => {
    expect(cacheSimilarityThreshold()).toBe(0.97);
    expect(cacheSimilarityThreshold("0.9")).toBe(0.9);
    expect(cacheSimilarityThreshold("0.2")).toBe(0.8);
    expect(cacheSimilarityThreshold("2")).toBe(1);
    expect(cacheSimilarityThreshold("invalid")).toBe(0.97);
  });

  it("bounds cache lifetime from one hour to one week", () => {
    expect(cacheTtlHours()).toBe(24);
    expect(cacheTtlHours("0")).toBe(1);
    expect(cacheTtlHours("500")).toBe(168);
    expect(cacheTtlHours("invalid")).toBe(24);
  });
});
