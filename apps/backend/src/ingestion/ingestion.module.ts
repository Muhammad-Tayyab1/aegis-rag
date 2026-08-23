import { Module } from "@nestjs/common";
import { IngestionService } from "./ingestion.service";
import { IngestionController } from "./ingestion.controller";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorSyncService } from "./connector-sync.service";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { UrlCrawlerService } from "./url-crawler.service";
@Module({
  imports: [RetrievalModule],
  providers: [IngestionService, ConnectorSyncService, UrlCrawlerService],
  controllers: [IngestionController, ConnectorsController],
})
export class IngestionModule {}
