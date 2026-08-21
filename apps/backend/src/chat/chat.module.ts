import {Module} from '@nestjs/common'
import {ChatController} from './chat.controller'
import {RetrievalModule} from '../retrieval/retrieval.module'
@Module({imports: [RetrievalModule], controllers: [ChatController]})
export class ChatModule {}
