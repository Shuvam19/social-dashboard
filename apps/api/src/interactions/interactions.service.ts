import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { InteractionType, Platform } from '@prisma/client';

@Injectable()
export class InteractionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: {
      type?: InteractionType;
      platform?: Platform;
      isReplied?: boolean;
      isHidden?: boolean;
      isRead?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const {
      type,
      platform,
      isReplied,
      isHidden = false,
      isRead,
      search,
      limit = 50,
      offset = 0,
    } = options || {};

    return this.prisma.interaction.findMany({
      where: {
        socialAccount: {
          tenantId,
          ...(platform && { platform }),
        },
        ...(type && { type }),
        ...(isReplied !== undefined && { isReplied }),
        ...(isRead !== undefined && { isRead }),
        isHidden,
        isDeleted: false,
        ...(search && {
          OR: [
            { messageText: { contains: search, mode: 'insensitive' as const } },
            { senderName: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      },
      include: {
        post: {
          select: {
            id: true,
            contentText: true,
            platformPostUrl: true,
          },
        },
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        parent: {
          select: {
            id: true,
            senderName: true,
            messageText: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string, tenantId: string) {
    const interaction = await this.prisma.interaction.findFirst({
      where: {
        id,
        socialAccount: { tenantId },
      },
      include: {
        post: true,
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            avatarUrl: true,
            platformUserId: true,
            platformUsername: true,
          },
        },
        parent: {
          select: {
            id: true,
            senderName: true,
            messageText: true,
          },
        },
        replies: {
          where: { isDeleted: false },
          orderBy: { receivedAt: 'asc' },
          select: {
            id: true,
            senderName: true,
            senderAvatarUrl: true,
            messageText: true,
            receivedAt: true,
            isReplied: true,
          },
        },
      },
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found');
    }

    return interaction;
  }

  async getUnreadCount(tenantId: string): Promise<number> {
    return this.prisma.interaction.count({
      where: {
        socialAccount: { tenantId },
        isRead: false,
        isDeleted: false,
        isHidden: false,
      },
    });
  }

  async getStats(tenantId: string) {
    const [total, unread, unreplied, byType, byPlatform] = await Promise.all([
      this.prisma.interaction.count({
        where: { socialAccount: { tenantId }, isDeleted: false },
      }),
      this.prisma.interaction.count({
        where: { socialAccount: { tenantId }, isRead: false, isDeleted: false },
      }),
      this.prisma.interaction.count({
        where: { socialAccount: { tenantId }, isReplied: false, isDeleted: false },
      }),
      this.prisma.interaction.groupBy({
        by: ['type'],
        where: { socialAccount: { tenantId }, isDeleted: false },
        _count: true,
      }),
      this.prisma.$queryRaw`
        SELECT sa.platform, COUNT(i.id)::int as count
        FROM interactions i
        JOIN social_accounts sa ON i.social_account_id = sa.id
        WHERE sa.tenant_id = ${tenantId} AND i.is_deleted = false
        GROUP BY sa.platform
      ` as Promise<{ platform: string; count: number }[]>,
    ]);

    return {
      total,
      unread,
      unreplied,
      byType: byType.reduce(
        (acc, item) => ({ ...acc, [item.type]: item._count }),
        {},
      ),
      byPlatform: (byPlatform || []).reduce(
        (acc: Record<string, number>, item: { platform: string; count: number }) => ({
          ...acc,
          [item.platform]: item.count,
        }),
        {},
      ),
    };
  }

  async markAsRead(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.interaction.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(tenantId: string) {
    return this.prisma.interaction.updateMany({
      where: {
        socialAccount: { tenantId },
        isRead: false,
        isDeleted: false,
      },
      data: { isRead: true },
    });
  }

  async markAsReplied(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.interaction.update({
      where: { id },
      data: { isReplied: true },
    });
  }

  async hide(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.interaction.update({
      where: { id },
      data: { isHidden: true },
    });
  }

  async unhide(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.interaction.update({
      where: { id },
      data: { isHidden: false },
    });
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // Soft delete
    return this.prisma.interaction.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // Called by webhook processor
  async createFromWebhook(data: {
    socialAccountId: string;
    postId?: string;
    type: InteractionType;
    platformInteractionId: string;
    senderId: string;
    senderName: string;
    senderAvatarUrl?: string;
    messageText: string;
    parentId?: string;
    rawPayload?: any;
    receivedAt?: Date;
  }) {
    return this.prisma.interaction.create({
      data: {
        socialAccountId: data.socialAccountId,
        postId: data.postId,
        type: data.type,
        platformInteractionId: data.platformInteractionId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatarUrl: data.senderAvatarUrl,
        messageText: data.messageText,
        parentId: data.parentId,
        rawPayload: data.rawPayload,
        receivedAt: data.receivedAt || new Date(),
      },
    });
  }
}
