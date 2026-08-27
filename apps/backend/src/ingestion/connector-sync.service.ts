import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/database/prisma.service";
import { IngestionService } from "./ingestion.service";
import { ConnectorFetchers } from "./connectors/connector-fetchers.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class ConnectorSyncService {
  constructor(
    private prisma: PrismaService,
    private ingestion: IngestionService,
    private fetchers: ConnectorFetchers,
    private audit: AuditService,
  ) {}
  @Cron("0 * * * *")
  async syncRestConnectors() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      const connectors = await this.prisma.withTenant(tenant.id, (tx) =>
        tx.connector.findMany({ where: { type: { in: ["rest", "crawler"] } } }),
      );
      for (const connector of connectors) {
        try {
          const config = connector.config as Record<string, string>;
          if (!config.url?.startsWith("https://")) continue;
          const [raw] = await this.fetchers.fetch(
            connector.type,
            connector.name,
            config,
          );
          await this.ingestion.ingest(
            tenant.id,
            raw.filename,
            raw.content,
            raw.sourceType,
            raw.sourceUri,
          );
          await this.prisma.withTenant(tenant.id, (tx) =>
            tx.connector.update({
              where: { id: connector.id },
              data: { lastSyncedAt: new Date() },
            }),
          );
          await this.audit.record({
            tenantId: tenant.id,
            action: "connector.sync",
            resourceType: "connector",
            resourceId: connector.id,
            result: "success",
            metadata: { source: "schedule", type: connector.type },
          });
        } catch (error) {
          await this.audit.record({
            tenantId: tenant.id,
            action: "connector.sync",
            resourceType: "connector",
            resourceId: connector.id,
            result: "failure",
            metadata: {
              source: "schedule",
              type: connector.type,
              errorType:
                error instanceof Error
                  ? error.constructor.name
                  : "UnknownError",
            },
          });
          continue;
        }
      }
    }
  }
}
