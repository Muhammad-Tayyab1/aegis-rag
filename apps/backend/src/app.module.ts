import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './common/database/database.module';
import { HealthController } from './health/health.controller';
import { TenantsModule } from './tenants/tenants.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ChatModule } from './chat/chat.module';
import { TracingController } from './tracing/tracing.controller';
import { UsageController } from './usage/usage.controller';
import { FeedbackController } from './feedback/feedback.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, TenantsModule, IngestionModule, ChatModule],
  controllers: [HealthController, TracingController, UsageController, FeedbackController],
})
export class AppModule {}
