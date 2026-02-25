import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MetricsFetchProcessor } from './metrics-fetch.processor';
import { MetricsCronService } from './metrics-cron.service';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { AdsModule } from '../ads/ads.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'metrics-fetch',
    }),
    SocialAccountsModule,
    AdsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, MetricsFetchProcessor, MetricsCronService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
