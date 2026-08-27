import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/database/prisma.service";
import { embed } from "../retrieval/embedding";
import { createHash } from "node:crypto";
import { sanitizeIngestedContent } from "./ingestion-security";

export type PreparedChunk = { ordinal: number; text: string; vector: string };
@Injectable()
export class IngestionService {
  constructor(private readonly prisma: PrismaService) {}
  async list(tenantId: string) {
    const documents = await this.prisma.withTenant(tenantId, (tx) =>
      tx.document.findMany({
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          filename: true,
          status: true,
          sourceType: true,
          uploadedAt: true,
          updatedAt: true,
          ingestionJobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { attempts: true, maxAttempts: true, lastError: true },
          },
        },
      }),
    );
    return documents.map(({ ingestionJobs, ...document }) => ({
      ...document,
      attempts: ingestionJobs[0]?.attempts ?? 0,
      maxAttempts: ingestionJobs[0]?.maxAttempts ?? 0,
      error: ingestionJobs[0]?.lastError ?? null,
    }));
  }
  remove(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const removed = await tx.document.deleteMany({ where: { id, tenantId } });
      if (removed.count)
        await tx.semanticCache.deleteMany({ where: { tenantId } });
      return removed;
    });
  }
  async chunkById(tenantId: string, documentId: string, chunkId: string) {
    const chunk = await this.prisma.withTenant(tenantId, (tx) =>
      tx.chunk.findFirst({
        where: { id: chunkId, documentId, tenantId },
        include: { document: { select: { filename: true } } },
      }),
    );
    if (!chunk) throw new NotFoundException("Chunk not found");
    return {
      id: chunk.id,
      documentId: chunk.documentId,
      filename: chunk.document.filename,
      ordinal: chunk.ordinal,
      content: chunk.content,
    };
  }
  chunk(text: string, size = 800, overlap = 100) {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    const out: string[] = [];
    for (let i = 0; i < words.length; i += size - overlap)
      out.push(words.slice(i, i + size).join(" "));
    return out.filter(Boolean);
  }

  async enqueue(
    tenantId: string,
    filename: string,
    content: string,
    sourceType = "file",
    sourceUri?: string,
  ) {
    content = sanitizeIngestedContent(content);
    const contentHash = createHash("sha256").update(content).digest("hex");
    return this.prisma.withTenant(tenantId, async (tx) => {
      const duplicate = await tx.document.findFirst({
        where: {
          tenantId,
          filename,
          contentHash,
          status: { in: ["pending", "processing", "ready"] },
        },
      });
      if (duplicate) return duplicate;
      const document = await tx.document.create({
        data: {
          tenantId,
          filename,
          sourceType,
          sourceUri,
          status: "pending",
          contentHash,
        },
      });
      await tx.ingestionJob.create({
        data: {
          tenantId,
          documentId: document.id,
          sourceKey: filename,
          content,
        },
      });
      return document;
    });
  }

  async retry(tenantId: string, documentId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const job = await tx.ingestionJob.findFirst({
        where: { tenantId, documentId, status: "failed" },
        orderBy: { createdAt: "desc" },
      });
      if (!job) throw new NotFoundException("Failed ingestion job not found");
      await tx.document.update({
        where: { id: documentId },
        data: { status: "pending", updatedAt: new Date() },
      });
      return tx.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: "pending",
          attempts: 0,
          availableAt: new Date(),
          lockedAt: null,
          lastError: null,
          updatedAt: new Date(),
        },
      });
    });
  }

  prepareChunks(
    content: string,
    chunkSize: number,
    chunkOverlap: number,
    embeddingModel?: string,
  ): PreparedChunk[] {
    return this.chunk(content, chunkSize, chunkOverlap).map(
      (text, ordinal) => ({
        ordinal,
        text,
        vector: `[${embed(text, embeddingModel).join(",")}]`,
      }),
    );
  }

  async completeQueued(
    tenantId: string,
    documentId: string,
    jobId: string,
    chunks: PreparedChunk[],
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const document = await tx.document.findFirstOrThrow({
        where: { id: documentId, tenantId },
      });
      for (const chunk of chunks) {
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO chunks (document_id,tenant_id,ordinal,content,embedding) VALUES (${document.id}::uuid,${tenantId}::uuid,${chunk.ordinal},${chunk.text},${chunk.vector}::vector)`,
        );
      }
      await tx.document.deleteMany({
        where: {
          tenantId,
          filename: document.filename,
          id: { not: document.id },
        },
      });
      await tx.semanticCache.deleteMany({ where: { tenantId } });
      await tx.ingestionJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          content: "",
          lockedAt: null,
          updatedAt: new Date(),
        },
      });
      return tx.document.update({
        where: { id: document.id },
        data: { status: "ready", updatedAt: new Date() },
      });
    });
  }
  async ingest(
    tenantId: string,
    filename: string,
    content: string,
    sourceType = "file",
    sourceUri?: string,
  ) {
    content = sanitizeIngestedContent(content);
    return this.prisma.withTenant(tenantId, async (tx) => {
      const config = await tx.tenantConfig.findUnique({ where: { tenantId } });
      const chunkSize = config?.chunkSize ?? 800;
      const chunkOverlap = Math.min(config?.chunkOverlap ?? 100, chunkSize - 1);
      const contentHash = createHash("sha256").update(content).digest("hex");
      const existing = await tx.document.findFirst({
        where: { tenantId, filename, contentHash },
      });
      if (existing) return existing;
      await tx.semanticCache.deleteMany({ where: { tenantId } });
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
      for (const { ordinal, text, vector } of this.prepareChunks(
        content,
        chunkSize,
        chunkOverlap,
        config?.embeddingModel,
      )) {
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
