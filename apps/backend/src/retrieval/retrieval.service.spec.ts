import { embed } from "./retrieval.service";
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
});
