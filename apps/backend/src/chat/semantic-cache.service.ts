import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/database/prisma.service";
import { embed } from "../retrieval/embedding";

export type SemanticCacheHit = {
  id: string;
  question: string;
  answer: string;
  citations: unknown;
  similarity: number;
};

export function cacheSimilarityThreshold(value?: string) {
  const parsed = Number(value ?? 0.97);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0.8), 1) : 0.97;
}

export function cacheTtlHours(value?: string) {
  const parsed = Number(value ?? 24);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 168) : 24;
}

@Injectable()
export class SemanticCacheService {
  constructor(private readonly prisma: PrismaService) {}

  find(tenantId: string, question: string) {
    const threshold = cacheSimilarityThreshold(
      process.env.SEMANTIC_CACHE_SIMILARITY,
    );
    return this.prisma.withTenant(tenantId, async (tx) => {
      const config = await tx.tenantConfig.findUnique({
        where: { tenantId },
        select: { embeddingModel: true },
      });
      const vector = `[${embed(question, config?.embeddingModel).join(",")}]`;
      const rows = await tx.$queryRaw<SemanticCacheHit[]>(
        Prisma.sql`SELECT id, question, answer, citations,
          (1 - (embedding <=> ${vector}::vector))::float AS similarity
          FROM semantic_cache
          WHERE tenant_id = ${tenantId}::uuid
            AND embedding IS NOT NULL
            AND expires_at > now()
            AND (1 - (embedding <=> ${vector}::vector)) >= ${threshold}
          ORDER BY embedding <=> ${vector}::vector
          LIMIT 1`,
      );
      return rows[0] ?? null;
    });
  }

  store(
    tenantId: string,
    question: string,
    answer: string,
    citations: Array<Record<string, string>>,
    transaction?: Prisma.TransactionClient,
  ) {
    const expiresAt = new Date(
      Date.now() +
        cacheTtlHours(process.env.SEMANTIC_CACHE_TTL_HOURS) * 3600000,
    );
    const insert = async (tx: Prisma.TransactionClient) => {
      const config = await tx.tenantConfig.findUnique({
        where: { tenantId },
        select: { embeddingModel: true },
      });
      const vector = `[${embed(question, config?.embeddingModel).join(",")}]`;
      return tx.$executeRaw(
        Prisma.sql`INSERT INTO semantic_cache
          (tenant_id, question, answer, citations, embedding, expires_at)
          VALUES (${tenantId}::uuid, ${question}, ${answer},
            ${JSON.stringify(citations)}::jsonb, ${vector}::vector, ${expiresAt})`,
      );
    };
    return transaction
      ? insert(transaction)
      : this.prisma.withTenant(tenantId, insert);
  }
}
