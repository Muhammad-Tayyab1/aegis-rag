import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/database/prisma.service";

export type AuditInput = {
  tenantId: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  result: "success" | "failure";
  ipAddress?: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEYS =
  /password|token|secret|authorization|cookie|connectionstring|credential|apiKey|encryptionKey|content/i;

export function redactAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redactAuditMetadata(child),
    ]),
  );
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    try {
      await this.prisma.withTenant(input.tenantId, (tx) =>
        tx.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorEmail: input.actorEmail,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            result: input.result,
            ipAddress: input.ipAddress,
            metadata: redactAuditMetadata(
              input.metadata ?? {},
            ) as Prisma.InputJsonValue,
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not persist audit event ${input.action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  list(
    tenantId: string,
    filters: {
      action?: string;
      actorEmail?: string;
      resourceType?: string;
      result?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit: number;
    },
  ) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.auditEvent.findMany({
        where: {
          tenantId,
          action: filters.action
            ? { contains: filters.action, mode: "insensitive" }
            : undefined,
          actorEmail: filters.actorEmail
            ? { contains: filters.actorEmail, mode: "insensitive" }
            : undefined,
          resourceType: filters.resourceType
            ? { equals: filters.resourceType, mode: "insensitive" }
            : undefined,
          result: filters.result,
          createdAt:
            filters.from || filters.to
              ? {
                  gte: filters.from ? new Date(filters.from) : undefined,
                  lte: filters.to ? new Date(filters.to) : undefined,
                }
              : undefined,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: filters.limit,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      }),
    );
  }
}
