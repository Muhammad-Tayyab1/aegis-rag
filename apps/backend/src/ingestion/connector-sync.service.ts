import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/database/prisma.service";
import { IngestionService } from "./ingestion.service";

@Injectable()
export class ConnectorSyncService {
  constructor(
    private prisma: PrismaService,
    private ingestion: IngestionService,
  ) {}
  @Cron("0 * * * *")
  async syncRestConnectors() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      const connectors = await this.prisma.withTenant(tenant.id, (tx) =>
        tx.connector.findMany({ where: { type: "rest" } }),
      );
      for (const connector of connectors) {
        try {
          const url = (connector.config as Record<string, string>).url;
          if (!url?.startsWith("https://")) continue;
          const response = await fetch(url, {
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) continue;
          await this.ingestion.ingest(
            tenant.id,
            connector.name,
            await response.text(),
            "rest",
            url,
          );
          await this.prisma.withTenant(tenant.id, (tx) =>
            tx.connector.update({
              where: { id: connector.id },
              data: { lastSyncedAt: new Date() },
            }),
          );
        } catch {
          continue;
        }
      }
    }
  }
}
