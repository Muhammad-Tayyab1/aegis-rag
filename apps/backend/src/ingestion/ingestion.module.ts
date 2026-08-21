import {Module} from '@nestjs/common'
import {IngestionService} from './ingestion.service'
import {IngestionController} from './ingestion.controller'
import {ConnectorsController} from './connectors.controller'
import {RetrievalModule} from '../retrieval/retrieval.module'
@Module({imports: [RetrievalModule], providers: [IngestionService], controllers: [IngestionController, ConnectorsController]})
export class IngestionModule {}
