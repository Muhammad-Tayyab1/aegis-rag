import { Module } from "@nestjs/common";
import { IngestionService } from "./ingestion.service";
import { IngestionController } from "./ingestion.controller";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorSyncService } from "./connector-sync.service";
import { RetrievalModule } from "../retrieval/retrieval.module";
@Module({
  imports: [RetrievalModule],
  providers: [IngestionService, ConnectorSyncService],
  controllers: [IngestionController, ConnectorsController],
})
export class IngestionModule {}
