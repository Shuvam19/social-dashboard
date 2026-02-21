import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhookIngestProcessor } from './webhook-ingest.processor';
import { InteractionsModule } from '../interactions/interactions.module';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'webhook-ingest',
    }),
    InteractionsModule,
    InboxModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhookIngestProcessor],
})
export class WebhooksModule {}
