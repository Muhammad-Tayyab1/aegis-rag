import { traceSequence } from "./trace-order";

describe("trace stage order", () => {
  it("matches the retrieval and generation pipeline", () => {
    expect(traceSequence("vector")).toBeLessThan(traceSequence("fusion"));
    expect(traceSequence("keyword")).toBeLessThan(traceSequence("fusion"));
    expect(traceSequence("fusion")).toBeLessThan(traceSequence("rerank"));
    expect(traceSequence("rerank")).toBeLessThan(traceSequence("generation"));
  });
});
