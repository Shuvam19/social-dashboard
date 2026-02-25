import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { MetaAdsClient } from './clients/meta-ads.client';
import {
  CreateAdCampaignDto,
  BoostPostDto,
  UpdateCampaignStatusDto,
} from './dto/ads.dto';
import {
  CampaignStatus,
  CampaignObjective,
  BudgetType,
  Platform,
  AdStatus,
  PostStatus,
} from '@prisma/client';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private prisma: PrismaService,
    private socialAccountsService: SocialAccountsService,
    private metaAdsClient: MetaAdsClient,
  ) {}

  // ============== Campaigns CRUD ==============

  async findAll(tenantId: string, status?: CampaignStatus) {
    return this.prisma.adCampaign.findMany({
      where: {
        tenantId,
        ...(status && { status }),
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            contentText: true,
            platformPostId: true,
          },
        },
        _count: {
          select: { adSets: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id, tenantId },
      include: {
        socialAccount: true,
        post: true,
        metrics: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        adSets: {
          include: {
            ads: {
              include: {
                post: {
                  select: {
                    id: true,
                    contentText: true,
                    platformPostId: true,
                    platformPostUrl: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async create(tenantId: string, dto: CreateAdCampaignDto) {
    // Verify social account belongs to tenant and is Meta platform
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        id: dto.socialAccountId,
        tenantId,
        isActive: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    if (
      account.platform !== Platform.FACEBOOK &&
      account.platform !== Platform.INSTAGRAM
    ) {
      throw new BadRequestException(
        'Ad campaigns are currently only supported for Facebook and Instagram',
      );
    }

    // Get decrypted tokens for Meta API call
    const tokens = await this.socialAccountsService.getDecryptedTokens(
      account.id,
    );

    // Resolve the ad account ID
    const adAccountId = await this.resolveAdAccountId(
      account,
      tokens.accessToken,
    );

    // Map objective to Meta API format
    const metaObjective = this.mapObjectiveToMeta(dto.objective);

    // Create campaign on Meta
    let platformCampaignId: string | null = null;
    try {
      const budgetParams: Record<string, string> = {};
      if (dto.budgetType === BudgetType.DAILY) {
        budgetParams.daily_budget = String(dto.budgetAmount);
      } else {
        budgetParams.lifetime_budget = String(dto.budgetAmount);
      }

      const metaResult = await this.metaAdsClient.createCampaign(
        adAccountId,
        tokens.accessToken,
        {
          name: dto.name,
          objective: metaObjective,
          status: 'PAUSED',
          ...budgetParams,
        },
      );
      platformCampaignId = metaResult.id;
      this.logger.log(`Created Meta campaign: ${platformCampaignId}`);
    } catch (error: any) {
      this.logger.error(`Failed to create Meta campaign: ${error.message}`);
      // Still create locally in DRAFT status
    }

    return this.prisma.adCampaign.create({
      data: {
        tenantId,
        socialAccountId: dto.socialAccountId,
        postId: dto.postId,
        name: dto.name,
        objective: dto.objective,
        budgetType: dto.budgetType,
        budgetAmount: dto.budgetAmount,
        currency: dto.currency || 'USD',
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        // targeting: dto.targeting || undefined,
        platformCampaignId,
        status: platformCampaignId
          ? CampaignStatus.PAUSED
          : CampaignStatus.DRAFT,
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
    });
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateCampaignStatusDto,
  ) {
    const campaign = await this.findOne(id, tenantId);

    // If campaign exists on Meta, update there too
    if (campaign.platformCampaignId) {
      try {
        const tokens = await this.socialAccountsService.getDecryptedTokens(
          campaign.socialAccountId,
        );
        const metaStatus = this.mapStatusToMeta(dto.status);
        await this.metaAdsClient.updateCampaignStatus(
          campaign.platformCampaignId,
          tokens.accessToken,
          metaStatus,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to update Meta campaign status: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to update campaign on Meta: ${error.message}`,
        );
      }
    }

    return this.prisma.adCampaign.update({
      where: { id },
      data: { status: dto.status },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
          },
        },
      },
    });
  }

  // ============== Boost Post ==============

  async boostPost(tenantId: string, dto: BoostPostDto) {
    // Validate the post exists and is published
    const post = await this.prisma.post.findFirst({
      where: { id: dto.postId, tenantId },
      include: {
        socialAccount: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status !== PostStatus.PUBLISHED) {
      throw new BadRequestException('Only published posts can be boosted');
    }

    if (!post.platformPostId) {
      throw new BadRequestException(
        'Post does not have a platform post ID',
      );
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: {
        id: dto.socialAccountId,
        tenantId,
        isActive: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    const tokens = await this.socialAccountsService.getDecryptedTokens(
      account.id,
    );
    const adAccountId = await this.resolveAdAccountId(
      account,
      tokens.accessToken,
    );

    const campaignName =
      dto.name || `Boost: ${post.contentText.substring(0, 40)}...`;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dto.duration);

    // 1. Create campaign on Meta
    const metaCampaign = await this.metaAdsClient.createCampaign(
      adAccountId,
      tokens.accessToken,
      {
        name: campaignName,
        objective: this.mapObjectiveToMeta(dto.objective),
        status: 'PAUSED',
      },
    );

    // 2. Create ad set on Meta
    const defaultTargeting = dto.targeting || {
      geo_locations: { countries: ['US'] },
      age_min: 18,
      age_max: 65,
    };

    const adSetParams = {
      name: `${campaignName} - Ad Set`,
      campaign_id: metaCampaign.id,
      targeting: defaultTargeting,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      optimization_goal: 'REACH',
      billing_event: 'IMPRESSIONS',
      status: 'PAUSED',
      ...(dto.budgetType === BudgetType.DAILY
        ? { daily_budget: String(dto.budgetAmount) }
        : { lifetime_budget: String(dto.budgetAmount) }),
    };

    const metaAdSet = await this.metaAdsClient.createAdSet(
      adAccountId,
      tokens.accessToken,
      adSetParams,
    );

    // 3. Create ad from existing post
    const metaAd = await this.metaAdsClient.createAdFromPost(
      adAccountId,
      tokens.accessToken,
      {
        name: `${campaignName} - Ad`,
        adset_id: metaAdSet.id,
        creative_object_story_id: post.platformPostId,
        status: 'PAUSED',
      },
    );

    // 4. Save everything locally
    const campaign = await this.prisma.adCampaign.create({
      data: {
        tenantId,
        socialAccountId: dto.socialAccountId,
        postId: dto.postId,
        platformCampaignId: metaCampaign.id,
        name: campaignName,
        objective: dto.objective,
        status: CampaignStatus.PAUSED,
        budgetType: dto.budgetType,
        budgetAmount: dto.budgetAmount,
        startDate,
        endDate,
        // targeting: dto.targeting || undefined,
        adSets: {
          // create: {
          //   platformAdSetId: metaAdSet.id,
          //   name: `${campaignName} - Ad Set`,
          //   status: AdStatus.PAUSED,
          //   dailyBudget:
          //     dto.budgetType === BudgetType.DAILY ? dto.budgetAmount : null,
          //   lifetimeBudget:
          //     dto.budgetType === BudgetType.LIFETIME ? dto.budgetAmount : null,
          //   targeting: defaultTargeting,
          //   startTime: startDate,
          //   endTime: endDate,
          //   ads: {
          //     create: {
          //       platformAdId: metaAd.id,
          //       postId: dto.postId,
          //       name: `${campaignName} - Ad`,
          //       status: AdStatus.PAUSED,
          //       creative: {
          //         object_story_id: post.platformPostId,
          //       },
          //     },
          //   },
          // },
        },
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
          },
        },
        adSets: {
          include: { ads: true },
        },
      },
    });

    return campaign;
  }

  // ============== Sync from Meta ==============

  async syncCampaigns(tenantId: string, socialAccountId: string) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id: socialAccountId, tenantId, isActive: true },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    const tokens = await this.socialAccountsService.getDecryptedTokens(
      account.id,
    );
    const adAccountId = await this.resolveAdAccountId(
      account,
      tokens.accessToken,
    );

    // Fetch campaigns from Meta
    const metaCampaigns = await this.metaAdsClient.getCampaigns(
      adAccountId,
      tokens.accessToken,
    );

    this.logger.log(
      `Syncing ${metaCampaigns.length} campaigns from Meta for account ${socialAccountId}`,
    );

    const results = [];

    for (const metaCampaign of metaCampaigns) {
      // Upsert campaign
      const campaign = await this.prisma.adCampaign.upsert({
        where: {
          // Use a compound lookup
          id:
            (
              await this.prisma.adCampaign.findFirst({
                where: {
                  tenantId,
                  socialAccountId,
                  platformCampaignId: metaCampaign.id,
                },
                select: { id: true },
              })
            )?.id || 'new-uuid-placeholder',
        },
        create: {
          tenantId,
          socialAccountId,
          platformCampaignId: metaCampaign.id,
          name: metaCampaign.name,
          objective: this.mapMetaObjective(metaCampaign.objective),
          status: this.mapMetaStatus(metaCampaign.status),
          budgetType: metaCampaign.lifetime_budget
            ? BudgetType.LIFETIME
            : BudgetType.DAILY,
          budgetAmount: parseInt(
            metaCampaign.daily_budget || metaCampaign.lifetime_budget || '0',
            10,
          ),
          startDate: metaCampaign.start_time
            ? new Date(metaCampaign.start_time)
            : new Date(),
          endDate: metaCampaign.stop_time
            ? new Date(metaCampaign.stop_time)
            : null,
        },
        update: {
          name: metaCampaign.name,
          status: this.mapMetaStatus(metaCampaign.status),
          budgetAmount: parseInt(
            metaCampaign.daily_budget || metaCampaign.lifetime_budget || '0',
            10,
          ),
        },
      });

      // Sync ad sets for this campaign
      try {
        const metaAdSets = await this.metaAdsClient.getAdSets(
          metaCampaign.id,
          tokens.accessToken,
        );

        for (const metaAdSet of metaAdSets) {
          const adSet = await this.prisma.adSet.upsert({
            where: {
              campaignId_platformAdSetId: {
                campaignId: campaign.id,
                platformAdSetId: metaAdSet.id,
              },
            },
            create: {
              campaignId: campaign.id,
              platformAdSetId: metaAdSet.id,
              name: metaAdSet.name,
              status: this.mapMetaAdStatus(metaAdSet.status),
              dailyBudget: metaAdSet.daily_budget
                ? parseInt(metaAdSet.daily_budget, 10)
                : null,
              lifetimeBudget: metaAdSet.lifetime_budget
                ? parseInt(metaAdSet.lifetime_budget, 10)
                : null,
              bidStrategy: metaAdSet.bid_strategy,
              // targeting: metaAdSet.targeting || undefined,
              startTime: metaAdSet.start_time
                ? new Date(metaAdSet.start_time)
                : null,
              endTime: metaAdSet.end_time
                ? new Date(metaAdSet.end_time)
                : null,
            },
            update: {
              name: metaAdSet.name,
              status: this.mapMetaAdStatus(metaAdSet.status),
              dailyBudget: metaAdSet.daily_budget
                ? parseInt(metaAdSet.daily_budget, 10)
                : null,
              lifetimeBudget: metaAdSet.lifetime_budget
                ? parseInt(metaAdSet.lifetime_budget, 10)
                : null,
              // targeting: metaAdSet.targeting || undefined,
            },
          });

          // Sync ads for this ad set
          try {
            const metaAds = await this.metaAdsClient.getAds(
              metaAdSet.id,
              tokens.accessToken,
            );

            for (const metaAd of metaAds) {
              await this.prisma.ad.upsert({
                where: {
                  adSetId_platformAdId: {
                    adSetId: adSet.id,
                    platformAdId: metaAd.id,
                  },
                },
                create: {
                  adSetId: adSet.id,
                  platformAdId: metaAd.id,
                  name: metaAd.name,
                  status: this.mapMetaAdStatus(metaAd.status),
                  creative: metaAd.creative || undefined,
                },
                update: {
                  name: metaAd.name,
                  status: this.mapMetaAdStatus(metaAd.status),
                  creative: metaAd.creative || undefined,
                },
              });
            }
          } catch (error: any) {
            this.logger.warn(
              `Failed to sync ads for ad set ${metaAdSet.id}: ${error.message}`,
            );
          }
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to sync ad sets for campaign ${metaCampaign.id}: ${error.message}`,
        );
      }

      results.push(campaign);
    }

    return {
      synced: results.length,
      campaigns: results,
    };
  }

  // ============== Ad Sets & Ads Read ==============

  async getAdSets(campaignId: string, tenantId: string) {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.adSet.findMany({
      where: { campaignId },
      include: {
        ads: true,
        _count: { select: { ads: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAds(campaignId: string, tenantId: string) {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.ad.findMany({
      where: {
        adSet: { campaignId },
      },
      include: {
        adSet: {
          select: {
            id: true,
            name: true,
          },
        },
        post: {
          select: {
            id: true,
            contentText: true,
            platformPostUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============== Delete Campaign ==============

  async deleteCampaign(id: string, tenantId: string) {
    const campaign = await this.findOne(id, tenantId);

    // If on Meta, set to DELETED
    if (campaign.platformCampaignId) {
      try {
        const tokens = await this.socialAccountsService.getDecryptedTokens(
          campaign.socialAccountId,
        );
        await this.metaAdsClient.updateCampaignStatus(
          campaign.platformCampaignId,
          tokens.accessToken,
          'DELETED',
        );
      } catch (error: any) {
        this.logger.warn(
          `Failed to delete campaign on Meta: ${error.message}`,
        );
      }
    }

    return this.prisma.adCampaign.delete({
      where: { id },
    });
  }

  // ============== Helpers ==============

  private async resolveAdAccountId(
    account: any,
    accessToken: string,
  ): Promise<string> {
    // Check if ad account ID is stored in metadata
    const metadata = account.metadata as Record<string, unknown> | null;
    if (metadata?.adAccountId) {
      return metadata.adAccountId as string;
    }

    // Fetch from Meta API
    const adAccounts = await this.metaAdsClient.getAdAccounts(accessToken);

    if (!adAccounts || adAccounts.length === 0) {
      throw new BadRequestException(
        'No ad accounts found for this Meta account. Please ensure you have an active ad account.',
      );
    }

    const adAccountId = adAccounts[0].id; // Use first ad account

    // Store for future use
    await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        metadata: {
          ...(metadata || {}),
          adAccountId,
          adAccountName: adAccounts[0].name,
          adAccountCurrency: adAccounts[0].currency,
        },
      },
    });

    return adAccountId;
  }

  private mapObjectiveToMeta(objective: CampaignObjective): string {
    const mapping: Record<CampaignObjective, string> = {
      [CampaignObjective.TRAFFIC]: 'OUTCOME_TRAFFIC',
      [CampaignObjective.AWARENESS]: 'OUTCOME_AWARENESS',
      [CampaignObjective.ENGAGEMENT]: 'OUTCOME_ENGAGEMENT',
      [CampaignObjective.LEADS]: 'OUTCOME_LEADS',
      [CampaignObjective.SALES]: 'OUTCOME_SALES',
    };
    return mapping[objective] || 'OUTCOME_TRAFFIC';
  }

  private mapMetaObjective(metaObjective: string): CampaignObjective {
    const mapping: Record<string, CampaignObjective> = {
      OUTCOME_TRAFFIC: CampaignObjective.TRAFFIC,
      LINK_CLICKS: CampaignObjective.TRAFFIC,
      OUTCOME_AWARENESS: CampaignObjective.AWARENESS,
      BRAND_AWARENESS: CampaignObjective.AWARENESS,
      REACH: CampaignObjective.AWARENESS,
      OUTCOME_ENGAGEMENT: CampaignObjective.ENGAGEMENT,
      POST_ENGAGEMENT: CampaignObjective.ENGAGEMENT,
      OUTCOME_LEADS: CampaignObjective.LEADS,
      LEAD_GENERATION: CampaignObjective.LEADS,
      OUTCOME_SALES: CampaignObjective.SALES,
      CONVERSIONS: CampaignObjective.SALES,
    };
    return mapping[metaObjective] || CampaignObjective.TRAFFIC;
  }

  private mapStatusToMeta(status: CampaignStatus): string {
    const mapping: Record<CampaignStatus, string> = {
      [CampaignStatus.DRAFT]: 'PAUSED',
      [CampaignStatus.PENDING]: 'PAUSED',
      [CampaignStatus.ACTIVE]: 'ACTIVE',
      [CampaignStatus.PAUSED]: 'PAUSED',
      [CampaignStatus.COMPLETED]: 'PAUSED',
      [CampaignStatus.REJECTED]: 'PAUSED',
    };
    return mapping[status] || 'PAUSED';
  }

  private mapMetaStatus(metaStatus: string): CampaignStatus {
    const mapping: Record<string, CampaignStatus> = {
      ACTIVE: CampaignStatus.ACTIVE,
      PAUSED: CampaignStatus.PAUSED,
      DELETED: CampaignStatus.COMPLETED,
      ARCHIVED: CampaignStatus.COMPLETED,
    };
    return mapping[metaStatus] || CampaignStatus.DRAFT;
  }

  private mapMetaAdStatus(metaStatus: string): AdStatus {
    const mapping: Record<string, AdStatus> = {
      ACTIVE: AdStatus.ACTIVE,
      PAUSED: AdStatus.PAUSED,
      DELETED: AdStatus.DELETED,
      PENDING_REVIEW: AdStatus.PENDING_REVIEW,
      DISAPPROVED: AdStatus.REJECTED,
      ARCHIVED: AdStatus.PAUSED,
    };
    return mapping[metaStatus] || AdStatus.DRAFT;
  }
}
