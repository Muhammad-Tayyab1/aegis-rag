import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/database/prisma.service";
import { embed } from "../retrieval/retrieval.service";
import { createHash } from "node:crypto";
@Injectable()
export class IngestionService {
  constructor(private readonly prisma: PrismaService) {}
  list(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.document.findMany({
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          filename: true,
          status: true,
          sourceType: true,
          uploadedAt: true,
          updatedAt: true,
        },
      }),
    );
  }
  remove(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.document.deleteMany({ where: { id, tenantId } }),
    );
  }
  chunk(text: string, size = 800, overlap = 100) {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    const out: string[] = [];
    for (let i = 0; i < words.length; i += size - overlap)
      out.push(words.slice(i, i + size).join(" "));
    return out.filter(Boolean);
  }
  async ingest(
    tenantId: string,
    filename: string,
    content: string,
    sourceType = "file",
    sourceUri?: string,
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const config = await tx.tenantConfig.findUnique({ where: { tenantId } });
      const chunkSize = config?.chunkSize ?? 800;
      const chunkOverlap = Math.min(config?.chunkOverlap ?? 100, chunkSize - 1);
      const contentHash = createHash("sha256").update(content).digest("hex");
      const existing = await tx.document.findFirst({
        where: { tenantId, filename, contentHash },
      });
      if (existing) return existing;
      await tx.document.deleteMany({ where: { tenantId, filename } });
      const doc = await tx.document.create({
        data: {
          tenantId,
          filename,
          sourceType,
          sourceUri,
          status: "processing",
          contentHash,
        },
      });
      for (const [ordinal, text] of this.chunk(
        content,
        chunkSize,
        chunkOverlap,
      ).entries()) {
        const vector = `[${embed(text).join(",")}]`;
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO chunks (document_id,tenant_id,ordinal,content,embedding) VALUES (${doc.id}::uuid,${tenantId}::uuid,${ordinal},${text},${vector}::vector)`,
        );
      }
      return tx.document.update({
        where: { id: doc.id },
        data: { status: "ready" },
      });
    });
  }
}
