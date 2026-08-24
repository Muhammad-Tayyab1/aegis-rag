import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/database/prisma.service";
import { embed } from "./embedding";
import { crossEncoderScores } from "./local-cross-encoder";
export { embed } from "./embedding";
export type Hit = {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  rank?: number;
  stages?: string[];
  stageScores?: Record<string, number>;
  stageRanks?: Record<string, number>;
  stageLatencies?: Record<string, number>;
  rerankProvider?: string;
  traceAttempt?: "initial" | "reformulated";
};
export const markReranked = (hit: Hit, latencyMs: number): Hit => ({
  ...hit,
  stages: [...new Set([...(hit.stages ?? []), "rerank"])],
  stageScores: { ...hit.stageScores, rerank: hit.score },
  stageRanks: { ...hit.stageRanks, rerank: hit.rank ?? 0 },
  stageLatencies: { ...hit.stageLatencies, rerank: latencyMs },
});
@Injectable()
export class RetrievalService {
  constructor(private prisma: PrismaService) {}
  async rerank(q: string, hits: Hit[]) {
    const key = process.env.COHERE_API_KEY;
    if (key)
      try {
        const r = await fetch("https://api.cohere.com/v2/rerank", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: process.env.COHERE_RERANK_MODEL ?? "rerank-v3.5",
            query: q,
            documents: hits.map((h) => h.content),
            top_n: hits.length,
          }),
        });
        if (r.ok) {
          const b = (await r.json()) as any;
          return (b.results ?? []).map((x: any, rank: number) => ({
            ...hits[x.index],
            score: x.relevance_score,
            rank: rank + 1,
            rerankProvider: "cohere",
          }));
        }
      } catch {}
    try {
      const scores = await crossEncoderScores(
        q,
        hits.map((hit) => hit.content),
      );
      return hits
        .map((hit, index) => ({
          ...hit,
          score: scores[index],
          rerankProvider: "local-cross-encoder",
        }))
        .sort((a, b) => b.score - a.score)
        .map((hit, index) => ({ ...hit, rank: index + 1 }));
    } catch {
      // Keep offline deployments usable if the configured model is not cached.
      // The trace names this emergency fallback so it cannot be mistaken for ML.
    }
    const terms = q.toLowerCase().split(/\W+/).filter(Boolean);
    return hits
      .map((h) => ({
        ...h,
        score:
          h.score +
          terms.filter((t) => h.content.toLowerCase().includes(t)).length * 0.1,
        rerankProvider: "lexical-emergency-fallback",
      }))
      .sort((a, b) => b.score - a.score)
      .map((h, i) => ({ ...h, rank: i + 1 }));
  }
  async search(t: string, q: string, limit = 8): Promise<Hit[]> {
    return this.prisma.withTenant(t, async (tx) => {
      const config = await tx.tenantConfig.findUnique({
        where: { tenantId: t },
      });
      const e = `[${embed(q, config?.embeddingModel).join(",")}]`;
      const strategy = config?.retrievalStrategy ?? "hybrid";
      const timed = async (run: Promise<Hit[]>) => {
        const started = performance.now();
        const rows = await run;
        return { rows, ms: Math.round(performance.now() - started) };
      };
      const [vectorResult, keywordResult] = await Promise.all([
        timed(
          strategy === "keyword"
            ? Promise.resolve([] as Hit[])
            : tx.$queryRaw<Hit[]>(
                Prisma.sql`SELECT c.id,c.document_id AS "documentId",d.filename,c.content,(1-(c.embedding <=> ${e}::vector))::float AS score FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.embedding IS NOT NULL ORDER BY c.embedding <=> ${e}::vector LIMIT ${limit}`,
              ),
        ),
        timed(
          strategy === "vector"
            ? Promise.resolve([] as Hit[])
            : tx.$queryRaw<Hit[]>(
                Prisma.sql`SELECT c.id,c.document_id AS "documentId",d.filename,c.content,ts_rank_cd(c.tsv,websearch_to_tsquery('english',${q}))::float AS score FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.tsv @@ websearch_to_tsquery('english',${q}) ORDER BY score DESC LIMIT ${limit}`,
              ),
        ),
      ]);
      const v = vectorResult.rows,
        k = keywordResult.rows;
      const fusionStarted = performance.now();
      const m = new Map<
        string,
        {
          h: Hit;
          s: number;
          stages: Set<string>;
          scores: Record<string, number>;
          ranks: Record<string, number>;
        }
      >();
      [v, k].forEach((a, sourceIndex) =>
        a.forEach((h, i) => {
          const stage = sourceIndex === 0 ? "vector" : "keyword";
          const x = m.get(h.id) ?? {
            h,
            s: 0,
            stages: new Set<string>(),
            scores: {},
            ranks: {},
          };
          x.s += 1 / (61 + i);
          x.stages.add(stage);
          x.scores[stage] = h.score;
          x.ranks[stage] = i + 1;
          m.set(h.id, x);
        }),
      );
      const fused = [...m.values()]
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((x, i) => ({
          ...x.h,
          score: x.s,
          rank: i + 1,
          stages: [...x.stages, "fusion"],
          stageScores: { ...x.scores, fusion: x.s },
          stageRanks: { ...x.ranks, fusion: i + 1 },
          stageLatencies: {
            vector: vectorResult.ms,
            keyword: keywordResult.ms,
            fusion: Math.round(performance.now() - fusionStarted),
          },
        }));
      if (config?.rerankEnabled === false) return fused;
      const rerankStarted = performance.now();
      const reranked: Hit[] = await this.rerank(q, fused);
      const rerankMs = Math.round(performance.now() - rerankStarted);
      return reranked.map((hit) => markReranked(hit, rerankMs));
    });
  }
}
