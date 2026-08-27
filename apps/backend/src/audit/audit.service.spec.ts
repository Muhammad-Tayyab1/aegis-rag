import { redactAuditMetadata } from "./audit.service";

describe("audit metadata redaction", () => {
  it("recursively removes secrets while preserving operational fields", () => {
    expect(
      redactAuditMetadata({
        action: "connector.create",
        password: "unsafe",
        nested: {
          connectionString: "postgres://secret",
          attempts: 2,
        },
        headers: [{ authorization: "Bearer token" }],
      }),
    ).toEqual({
      action: "connector.create",
      password: "[REDACTED]",
      nested: { connectionString: "[REDACTED]", attempts: 2 },
      headers: [{ authorization: "[REDACTED]" }],
    });
  });
});
