import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./common/database/database.module";
import { HealthController } from "./health/health.controller";
import { TenantsModule } from "./tenants/tenants.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { ChatModule } from "./chat/chat.module";
import { TracingController } from "./tracing/tracing.controller";
import { UsageController } from "./usage/usage.controller";
import { FeedbackController } from "./feedback/feedback.controller";
import { TicketController } from "./tools/ticket.controller";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    TenantsModule,
    IngestionModule,
    ChatModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  ],
  controllers: [
    HealthController,
    TracingController,
    UsageController,
    FeedbackController,
    TicketController,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
