import { Module } from "@nestjs/common";
import { IngestionService } from "./ingestion.service";
import { IngestionController } from "./ingestion.controller";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorSyncService } from "./connector-sync.service";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { UrlCrawlerService } from "./url-crawler.service";
import {
  ConnectorFetchers,
  CrawlerConnector,
  PostgresConnector,
  RestConnector,
} from "./connectors/connector-fetchers.service";
import { IngestionWorkerService } from "./ingestion-worker.service";
@Module({
  imports: [RetrievalModule],
  providers: [
    IngestionService,
    ConnectorSyncService,
    UrlCrawlerService,
    ConnectorFetchers,
    RestConnector,
    CrawlerConnector,
    PostgresConnector,
    IngestionWorkerService,
  ],
  controllers: [IngestionController, ConnectorsController],
})
export class IngestionModule {}
