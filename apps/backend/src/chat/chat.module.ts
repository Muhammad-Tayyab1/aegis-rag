import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { LlmService } from "./llm.service";
import { SemanticCacheService } from "./semantic-cache.service";
@Module({
  imports: [RetrievalModule],
  controllers: [ChatController],
  providers: [LlmService, SemanticCacheService],
})
export class ChatModule {}
