export type TicketIntent = {
  summary: string;
  priority: "low" | "medium" | "high";
};

export function parseTicketIntent(question: string): TicketIntent | undefined {
  const match = question.match(
    /(?:file|create|open)\s+(?:an?\s+)?(?:(high|medium|low|urgent|critical)(?:[- ]priority)?\s+)?(?:bug|ticket)(?:\s+for)?\s+(.+)/i,
  );
  if (!match) return undefined;
  const explicit = match[1]?.toLowerCase();
  const priority =
    explicit === "high" || /urgent|critical/i.test(question)
      ? "high"
      : explicit === "low"
        ? "low"
        : "medium";
  return { summary: match[2].trim(), priority };
}
