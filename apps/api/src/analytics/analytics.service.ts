import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { MetaAdsClient } from '../ads/clients/meta-ads.client';
import { Platform, MetricEntityType } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private socialAccountsService: SocialAccountsService,
    private metaAdsClient: MetaAdsClient,
  ) {}

  // ============== Dashboard Summary ==============

  async getSummary(tenantId: string, from?: string, to?: string) {
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    // Get metrics for current period
    const currentMetrics = await this.prisma.campaignMetric.aggregate({
      where: {
        campaign: { tenantId },
        date: { gte: dateFrom, lte: dateTo },
      },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
      },
    });

    // Get metrics for previous period (same duration)
    const periodDuration = dateTo.getTime() - dateFrom.getTime();
    const prevFrom = new Date(dateFrom.getTime() - periodDuration);
    const prevTo = new Date(dateFrom.getTime() - 1);

    const prevMetrics = await this.prisma.campaignMetric.aggregate({
      where: {
        campaign: { tenantId },
        date: { gte: prevFrom, lte: prevTo },
      },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
      },
    });

    // Active campaigns count
    const activeCampaigns = await this.prisma.adCampaign.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });

    const totalSpend = currentMetrics._sum.spend || 0;
    const totalImpressions = currentMetrics._sum.impressions || 0;
    const totalClicks = currentMetrics._sum.clicks || 0;
    const totalConversions = currentMetrics._sum.conversions || 0;

    const prevSpend = prevMetrics._sum.spend || 0;
    const prevImpressions = prevMetrics._sum.impressions || 0;
    const prevClicks = prevMetrics._sum.clicks || 0;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      activeCampaigns,
      spendChange: this.calcPercentChange(prevSpend, totalSpend),
      impressionsChange: this.calcPercentChange(
        prevImpressions,
        totalImpressions,
      ),
      clicksChange: this.calcPercentChange(prevClicks, totalClicks),
    };
  }

  // ============== Overview (with daily time series) ==============

  async getOverview(tenantId: string, from?: string, to?: string) {
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    const summary = await this.getSummary(tenantId, from, to);

    // Daily metrics
    const dailyMetrics = await this.prisma.campaignMetric.groupBy({
      by: ['date'],
      where: {
        campaign: { tenantId },
        date: { gte: dateFrom, lte: dateTo },
      },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
      },
      orderBy: { date: 'asc' },
    });

    // Top campaigns
    const topCampaigns = await this.prisma.adCampaign.findMany({
      where: {
        tenantId,
        totalSpend: { gt: 0 },
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
          },
        },
      },
      orderBy: { totalSpend: 'desc' },
      take: 10,
    });

    return {
      summary,
      dailyMetrics: dailyMetrics.map((m) => ({
        date: m.date.toISOString().split('T')[0],
        spend: m._sum.spend || 0,
        impressions: m._sum.impressions || 0,
        clicks: m._sum.clicks || 0,
        conversions: m._sum.conversions || 0,
      })),
      topCampaigns,
    };
  }

  // ============== Campaign Time Series ==============

  async getCampaignTimeSeries(
    campaignId: string,
    tenantId: string,
    from?: string,
    to?: string,
  ) {
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    // Verify campaign belongs to tenant
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const metrics = await this.prisma.campaignMetric.findMany({
      where: {
        campaignId,
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: 'asc' },
    });

    return metrics.map((m) => ({
      date: m.date.toISOString().split('T')[0],
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
    }));
  }

  // ============== Fetch Metrics from Meta (called by cron) ==============

  async fetchDailyMetricsForAccount(
    socialAccountId: string,
  ): Promise<{ updated: number }> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
    });

    if (!account) {
      this.logger.warn(`Account ${socialAccountId} not found`);
      return { updated: 0 };
    }

    if (
      account.platform !== Platform.FACEBOOK &&
      account.platform !== Platform.INSTAGRAM
    ) {
      return { updated: 0 };
    }

    const tokens = await this.socialAccountsService.getDecryptedTokens(
      socialAccountId,
    );

    // Find all campaigns for this account
    const campaigns = await this.prisma.adCampaign.findMany({
      where: {
        socialAccountId,
        platformCampaignId: { not: null },
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });

    let updatedCount = 0;

    for (const campaign of campaigns) {
      try {
        // Fetch yesterday's insights
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        const insights = await this.metaAdsClient.getInsights(
          campaign.platformCampaignId!,
          tokens.accessToken,
          {
            time_range: { since: dateStr, until: dateStr },
            time_increment: '1',
          },
        );

        if (insights.length > 0) {
          const insight = insights[0];
          const spend = Math.round(parseFloat(insight.spend || '0') * 100); // Convert to cents
          const impressions = parseInt(insight.impressions || '0', 10);
          const clicks = parseInt(insight.clicks || '0', 10);
          const conversions = insight.actions
            ? insight.actions.reduce(
                (sum, a) =>
                  a.action_type === 'offsite_conversion'
                    ? sum + parseInt(a.value, 10)
                    : sum,
                0,
              )
            : 0;

          // Upsert daily metric
          await this.prisma.campaignMetric.upsert({
            where: {
              campaignId_date: {
                campaignId: campaign.id,
                date: yesterday,
              },
            },
            create: {
              campaignId: campaign.id,
              date: yesterday,
              spend,
              impressions,
              clicks,
              conversions,
            },
            update: {
              spend,
              impressions,
              clicks,
              conversions,
            },
          });

          // Also store in granular AdMetric table
          await this.prisma.adMetric.upsert({
            where: {
              entityType_entityId_date: {
                entityType: MetricEntityType.CAMPAIGN,
                entityId: campaign.id,
                date: yesterday,
              },
            },
            create: {
              entityType: MetricEntityType.CAMPAIGN,
              entityId: campaign.id,
              date: yesterday,
              spend,
              impressions,
              clicks,
              conversions,
              ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
              cpc: clicks > 0 ? spend / clicks : 0,
              cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
            },
            update: {
              spend,
              impressions,
              clicks,
              conversions,
              ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
              cpc: clicks > 0 ? spend / clicks : 0,
              cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
            },
          });

          // Update campaign aggregates
          await this.updateCampaignAggregates(campaign.id);

          updatedCount++;
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to fetch metrics for campaign ${campaign.id}: ${error.message}`,
        );
      }
    }

    return { updated: updatedCount };
  }

  // ============== Aggregate Updater ==============

  private async updateCampaignAggregates(campaignId: string) {
    const aggregates = await this.prisma.campaignMetric.aggregate({
      where: { campaignId },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        conversions: true,
      },
    });

    await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        totalSpend: aggregates._sum.spend || 0,
        totalImpressions: aggregates._sum.impressions || 0,
        totalClicks: aggregates._sum.clicks || 0,
        totalConversions: aggregates._sum.conversions || 0,
      },
    });
  }

  // ============== Helpers ==============

  private calcPercentChange(prev: number, current: number): number {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100 * 10) / 10;
  }
}
