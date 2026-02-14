import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignStatus } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

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
          },
        },
        post: {
          select: {
            id: true,
            contentText: true,
          },
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
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async create(tenantId: string, createCampaignDto: CreateCampaignDto) {
    // Verify social account belongs to tenant
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        id: createCampaignDto.socialAccountId,
        tenantId,
        isActive: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return this.prisma.adCampaign.create({
      data: {
        tenantId,
        socialAccountId: createCampaignDto.socialAccountId,
        postId: createCampaignDto.postId,
        name: createCampaignDto.name,
        objective: createCampaignDto.objective,
        budgetType: createCampaignDto.budgetType,
        budgetAmount: createCampaignDto.budgetAmount,
        currency: createCampaignDto.currency || 'USD',
        startDate: new Date(createCampaignDto.startDate),
        endDate: createCampaignDto.endDate
          ? new Date(createCampaignDto.endDate)
          : null,
        status: CampaignStatus.DRAFT,
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

  async getMetricsSummary(tenantId: string) {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { tenantId },
      select: {
        totalSpend: true,
        totalImpressions: true,
        totalClicks: true,
        totalConversions: true,
      },
    });

    return campaigns.reduce(
      (acc, campaign) => ({
        totalSpend: acc.totalSpend + campaign.totalSpend,
        totalImpressions: acc.totalImpressions + campaign.totalImpressions,
        totalClicks: acc.totalClicks + campaign.totalClicks,
        totalConversions: acc.totalConversions + campaign.totalConversions,
      }),
      { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 },
    );
  }
}
