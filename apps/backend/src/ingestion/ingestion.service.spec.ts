import { IngestionService } from "./ingestion.service";

describe("IngestionService chunking", () => {
  const service = new IngestionService({} as never);
  it("honors chunk size and overlap", () => {
    const chunks = service.chunk("one two three four five", 3, 1);
    expect(chunks).toEqual(["one two three", "three four five", "five"]);
  });
  it("does not create empty chunks", () => {
    expect(service.chunk("   ", 3, 1)).toEqual([]);
  });
});
