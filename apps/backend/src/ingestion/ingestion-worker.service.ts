import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/database/prisma.service";
import { IngestionService } from "./ingestion.service";
import { AuditService } from "../audit/audit.service";

type ClaimedJob = {
  id: string;
  tenantId: string;
  documentId: string;
  content: string;
  attempts: number;
  maxAttempts: number;
};

@Injectable()
export class IngestionWorkerService {
  private readonly logger = new Logger(IngestionWorkerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly audit: AuditService,
  ) {}

  @Cron("*/5 * * * * *")
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const job = await this.claim();
        if (!job) break;
        await this.process(job);
      }
    } finally {
      this.running = false;
    }
  }

  private async claim(): Promise<ClaimedJob | null> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      try {
        const job = await this.prisma.withTenant(tenant.id, async (tx) => {
          const rows = await tx.$queryRaw<ClaimedJob[]>`
          WITH candidate AS (
            SELECT id
            FROM ingestion_jobs
            WHERE tenant_id = ${tenant.id}::uuid
              AND ((status = 'pending' AND available_at <= now())
                OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
            ORDER BY available_at, created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE ingestion_jobs AS job
          SET status = 'processing', attempts = attempts + 1,
              locked_at = now(), updated_at = now(), last_error = NULL
          FROM candidate
          WHERE job.id = candidate.id
          RETURNING job.id, job.tenant_id AS "tenantId",
                    job.document_id AS "documentId", job.content,
                    job.attempts, job.max_attempts AS "maxAttempts"
          `;
          if (!rows[0]) return null;
          await tx.document.update({
            where: { id: rows[0].documentId },
            data: { status: "processing", updatedAt: new Date() },
          });
          return rows[0];
        });
        if (job) return job;
      } catch {
        // Another replica may have claimed a newer version of the same source.
        // The partial unique index serializes those replacements safely.
        continue;
      }
    }
    return null;
  }

  private async process(job: ClaimedJob) {
    try {
      const config = await this.prisma.withTenant(job.tenantId, (tx) =>
        tx.tenantConfig.findUnique({ where: { tenantId: job.tenantId } }),
      );
      const chunkSize = config?.chunkSize ?? 800;
      const overlap = Math.min(config?.chunkOverlap ?? 100, chunkSize - 1);
      const chunks = this.ingestion.prepareChunks(
        job.content,
        chunkSize,
        overlap,
        config?.embeddingModel,
      );
      await this.ingestion.completeQueued(
        job.tenantId,
        job.documentId,
        job.id,
        chunks,
      );
      await this.audit.record({
        tenantId: job.tenantId,
        action: "document.ingestion_completed",
        resourceType: "document",
        resourceId: job.documentId,
        result: "success",
        metadata: { attempts: job.attempts, chunks: chunks.length },
      });
    } catch (error) {
      await this.fail(job, error);
    }
  }

  private async fail(job: ClaimedJob, error: unknown) {
    const terminal = job.attempts >= job.maxAttempts;
    const message = (
      error instanceof Error ? error.message : "Unknown error"
    ).slice(0, 500);
    const delaySeconds = Math.min(300, 5 * 2 ** Math.max(0, job.attempts - 1));
    await this.prisma.withTenant(job.tenantId, async (tx) => {
      await tx.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: terminal ? "failed" : "pending",
          availableAt: new Date(Date.now() + delaySeconds * 1000),
          lockedAt: null,
          lastError: message,
          updatedAt: new Date(),
        },
      });
      await tx.document.update({
        where: { id: job.documentId },
        data: {
          status: terminal ? "failed" : "pending",
          updatedAt: new Date(),
        },
      });
    });
    this.logger.warn(`Ingestion job ${job.id} failed: ${message}`);
    await this.audit.record({
      tenantId: job.tenantId,
      action: terminal
        ? "document.ingestion_failed"
        : "document.ingestion_retry_scheduled",
      resourceType: "document",
      resourceId: job.documentId,
      result: terminal ? "failure" : "success",
      metadata: {
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: message,
      },
    });
  }
}
