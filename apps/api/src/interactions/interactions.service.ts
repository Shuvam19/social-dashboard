import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { InteractionType } from '@prisma/client';

@Injectable()
export class InteractionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: {
      type?: InteractionType;
      isReplied?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const { type, isReplied, limit = 50, offset = 0 } = options || {};

    return this.prisma.interaction.findMany({
      where: {
        socialAccount: { tenantId },
        ...(type && { type }),
        ...(isReplied !== undefined && { isReplied }),
        isDeleted: false,
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
        socialAccount: true,
      },
    });

    if (!interaction) {
      throw new NotFoundException('Interaction not found');
    }

    return interaction;
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

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // Soft delete
    return this.prisma.interaction.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // This will be called by webhooks in Phase 2
  async createFromWebhook(data: {
    socialAccountId: string;
    postId?: string;
    type: InteractionType;
    platformInteractionId: string;
    senderId: string;
    senderName: string;
    senderAvatarUrl?: string;
    messageText: string;
    receivedAt?: Date;
  }) {
    return this.prisma.interaction.create({
      data: {
        ...data,
        receivedAt: data.receivedAt || new Date(),
      },
    });
  }
}
