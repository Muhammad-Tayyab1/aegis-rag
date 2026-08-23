import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { LlmService } from "./llm.service";
import { SemanticCacheService } from "./semantic-cache.service";
import { GroqProvider } from "./providers/groq.provider";
import { LocalProvider } from "./providers/local.provider";
@Module({
  imports: [RetrievalModule],
  controllers: [ChatController],
  providers: [LlmService, SemanticCacheService, GroqProvider, LocalProvider],
})
export class ChatModule {}
