import { parseTicketIntent } from "./ticket-intent";

describe("ticket intent", () => {
  it.each([
    ["file a bug for checkout", "checkout", "medium"],
    [
      "File a high priority ticket for IPC-104 breach",
      "IPC-104 breach",
      "high",
    ],
    ["open low-priority ticket for typo", "typo", "low"],
    ["create an urgent bug for login", "login", "high"],
  ])("parses %s", (question, summary, priority) => {
    expect(parseTicketIntent(question)).toEqual({ summary, priority });
  });

  it("does not treat an ordinary question as a tool action", () => {
    expect(parseTicketIntent("How do I file a claim?")).toBeUndefined();
  });
});
