import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/database/prisma.service";
import { IngestionService } from "./ingestion.service";
import { UrlCrawlerService } from "./url-crawler.service";

@Injectable()
export class ConnectorSyncService {
  constructor(
    private prisma: PrismaService,
    private ingestion: IngestionService,
    private crawler: UrlCrawlerService,
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
          const url = config.url;
          if (!url?.startsWith("https://")) continue;
          const text =
            connector.type === "crawler"
              ? (await this.crawler.crawl(url, config.maxPages)).text
              : (await this.crawler.fetchPublicText(url)).body;
          await this.ingestion.ingest(
            tenant.id,
            connector.name,
            text,
            connector.type,
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
