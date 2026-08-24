const stageSequence: Record<string, number> = {
  reroute: 10,
  semantic_cache: 10,
  vector: 20,
  keyword: 20,
  fusion: 30,
  rerank: 40,
  generation: 50,
  "tool:create_ticket": 50,
};

export function traceSequence(stage: string) {
  return stageSequence[stage] ?? 45;
}
