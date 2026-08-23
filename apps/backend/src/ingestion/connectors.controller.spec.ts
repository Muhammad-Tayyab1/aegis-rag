import { isReadOnlySelect } from "./connectors.controller";

describe("PostgreSQL connector query validation", () => {
  it("accepts a single SELECT statement", () => {
    expect(isReadOnlySelect(" SELECT id, title FROM policies LIMIT 100")).toBe(
      true,
    );
  });

  it("rejects stacked and mutating statements", () => {
    expect(
      isReadOnlySelect("SELECT * FROM policies; DELETE FROM policies"),
    ).toBe(false);
    expect(isReadOnlySelect("UPDATE policies SET title = 'x'")).toBe(false);
    expect(isReadOnlySelect("COPY policies TO '/tmp/export'")).toBe(false);
  });
});
