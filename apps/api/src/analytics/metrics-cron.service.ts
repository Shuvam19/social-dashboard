import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../config/prisma.service';
import { Platform } from '@prisma/client';

@Injectable()
export class MetricsCronService {
  private readonly logger = new Logger(MetricsCronService.name);

  constructor(
    @InjectQueue('metrics-fetch') private metricsFetchQueue: Queue,
    private prisma: PrismaService,
  ) {}

  /**
   * Run daily at 6 AM UTC to fetch yesterday's metrics for all active Meta accounts.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, {
    name: 'daily-metrics-fetch',
    timeZone: 'UTC',
  })
  async handleDailyMetricsFetch() {
    this.logger.log('Starting daily metrics fetch cron job');

    try {
      // Find all active Meta accounts that have campaigns
      const accounts = await this.prisma.socialAccount.findMany({
        where: {
          isActive: true,
          platform: { in: [Platform.FACEBOOK, Platform.INSTAGRAM] },
          campaigns: {
            some: {
              platformCampaignId: { not: null },
              status: { in: ['ACTIVE', 'PAUSED'] },
            },
          },
        },
        select: { id: true, displayName: true, platform: true },
      });

      this.logger.log(
        `Found ${accounts.length} Meta accounts with active campaigns`,
      );

      // Enqueue a job for each account
      for (const account of accounts) {
        await this.metricsFetchQueue.add(
          'fetch-daily',
          {
            socialAccountId: account.id,
            triggerType: 'cron',
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            // Stagger jobs to avoid rate limits
            delay: accounts.indexOf(account) * 2000,
          },
        );

        this.logger.log(
          `Enqueued metrics fetch for ${account.displayName} (${account.platform})`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to enqueue metrics fetch jobs: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manual trigger for fetching metrics for a specific account.
   */
  async triggerManualFetch(socialAccountId: string) {
    await this.metricsFetchQueue.add(
      'fetch-manual',
      {
        socialAccountId,
        triggerType: 'manual',
      },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 3000 },
      },
    );

    return { message: 'Metrics fetch job enqueued' };
  }
}
