import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalyticsService } from './analytics.service';

interface MetricsFetchJobData {
  socialAccountId: string;
  triggerType: 'cron' | 'manual';
}

@Processor('metrics-fetch', {
  concurrency: 3,
  limiter: {
    max: 10,
    duration: 1000,
  },
})
export class MetricsFetchProcessor extends WorkerHost {
  private readonly logger = new Logger(MetricsFetchProcessor.name);

  constructor(private analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job<MetricsFetchJobData>): Promise<any> {
    const { socialAccountId, triggerType } = job.data;

    this.logger.log(
      `Fetching metrics for account ${socialAccountId} (trigger: ${triggerType}, attempt: ${job.attemptsMade + 1})`,
    );

    try {
      const result =
        await this.analyticsService.fetchDailyMetricsForAccount(
          socialAccountId,
        );

      this.logger.log(
        `Updated ${result.updated} campaign metrics for account ${socialAccountId}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch metrics for account ${socialAccountId}: ${error.message}`,
        error.stack,
      );
      throw error; // Let BullMQ handle retry
    }
  }
}
