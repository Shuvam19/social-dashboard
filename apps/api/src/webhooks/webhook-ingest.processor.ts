import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../config/prisma.service';
import { InteractionsService } from '../interactions/interactions.service';
import { InboxGateway } from '../inbox/inbox.gateway';
import { Platform } from '@prisma/client';
import {
  parseMetaPayload,
  parseTwitterPayload,
  parseLinkedInPayload,
  parseTikTokPayload,
  parsePinterestPayload,
  ParsedInteraction,
  WebhookParseResult,
} from './parsers';

interface WebhookJobData {
  platform: string;
  payload: any;
  headers: Record<string, string>;
  receivedAt: string;
}

@Processor('webhook-ingest', {
  concurrency: 5,
  limiter: {
    max: 50,
    duration: 1000, // 50 jobs per second max
  },
})
export class WebhookIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookIngestProcessor.name);

  constructor(
    private prisma: PrismaService,
    private interactionsService: InteractionsService,
    private inboxGateway: InboxGateway,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<any> {
    const { platform, payload, headers, receivedAt } = job.data;

    this.logger.log(
      `Processing webhook job ${job.id} from ${platform} (attempt ${job.attemptsMade + 1})`,
    );

    // Log the webhook
    const webhookLog = await this.prisma.webhookLog.create({
      data: {
        platform: this.mapPlatformEnum(platform),
        payload,
        headers,
        receivedAt: new Date(receivedAt),
      },
    });

    try {
      // Parse the payload
      const parseResult = this.parsePayload(platform, payload);

      if (parseResult.interactions.length === 0) {
        this.logger.log(`No interactions found in ${platform} webhook`);
        await this.markWebhookProcessed(webhookLog.id, parseResult.eventType);
        return { processed: 0, eventType: parseResult.eventType };
      }

      // Update webhook log with event type
      await this.prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { eventType: parseResult.eventType },
      });

      // Process each interaction
      let processedCount = 0;
      for (const parsed of parseResult.interactions) {
        try {
          await this.processInteraction(parsed);
          processedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to process interaction: ${error.message}`,
            error.stack,
          );
          // Continue processing other interactions
        }
      }

      await this.markWebhookProcessed(webhookLog.id, parseResult.eventType);

      this.logger.log(
        `Processed ${processedCount}/${parseResult.interactions.length} interactions from ${platform}`,
      );

      return {
        processed: processedCount,
        total: parseResult.interactions.length,
        eventType: parseResult.eventType,
      };
    } catch (error) {
      // Log error to webhook log
      await this.prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          error: error.message,
          attempts: job.attemptsMade + 1,
        },
      });

      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  private parsePayload(platform: string, payload: any): WebhookParseResult {
    switch (platform) {
      case 'meta':
        return parseMetaPayload(payload);
      case 'twitter':
        return parseTwitterPayload(payload);
      case 'linkedin':
        return parseLinkedInPayload(payload);
      case 'tiktok':
        return parseTikTokPayload(payload);
      case 'pinterest':
        return parsePinterestPayload(payload);
      default:
        return { interactions: [], eventType: `${platform}_unknown` };
    }
  }

  private async processInteraction(parsed: ParsedInteraction): Promise<void> {
    // Find the social account by platform user ID
    const socialAccount = await this.prisma.socialAccount.findFirst({
      where: {
        platformUserId: parsed.platformUserId,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        platform: true,
      },
    });

    if (!socialAccount) {
      this.logger.warn(
        `No social account found for platform user ID: ${parsed.platformUserId}`,
      );
      return;
    }

    // Find the post if we have a platform post ID
    let postId: string | undefined;
    if (parsed.platformPostId) {
      const post = await this.prisma.post.findFirst({
        where: {
          socialAccountId: socialAccount.id,
          platformPostId: parsed.platformPostId,
        },
        select: { id: true },
      });
      postId = post?.id;
    }

    // Resolve parent interaction for threading
    let parentId: string | undefined;
    if (parsed.parentPlatformInteractionId) {
      const parent = await this.prisma.interaction.findFirst({
        where: {
          socialAccountId: socialAccount.id,
          platformInteractionId: parsed.parentPlatformInteractionId,
        },
        select: { id: true },
      });
      parentId = parent?.id;
    }

    // Check for duplicate interaction
    const existing = await this.prisma.interaction.findUnique({
      where: {
        socialAccountId_platformInteractionId: {
          socialAccountId: socialAccount.id,
          platformInteractionId: parsed.platformInteractionId,
        },
      },
    });

    if (existing) {
      this.logger.log(
        `Duplicate interaction skipped: ${parsed.platformInteractionId}`,
      );
      return;
    }

    // Create the interaction
    const interaction = await this.interactionsService.createFromWebhook({
      socialAccountId: socialAccount.id,
      postId,
      type: parsed.type,
      platformInteractionId: parsed.platformInteractionId,
      senderId: parsed.senderId,
      senderName: parsed.senderName,
      senderAvatarUrl: parsed.senderAvatarUrl,
      messageText: parsed.messageText,
      parentId,
      rawPayload: parsed.rawPayload,
      receivedAt: parsed.receivedAt,
    });

    // Broadcast via WebSocket to the tenant's connected clients
    const fullInteraction = await this.interactionsService.findOne(
      interaction.id,
      socialAccount.tenantId,
    );

    this.inboxGateway.sendNewInteraction(socialAccount.tenantId, fullInteraction);

    this.logger.log(
      `Created interaction ${interaction.id} for tenant ${socialAccount.tenantId}`,
    );
  }

  private async markWebhookProcessed(
    webhookLogId: string,
    eventType: string,
  ): Promise<void> {
    await this.prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        processedAt: new Date(),
        eventType,
      },
    });
  }

  private mapPlatformEnum(platform: string): Platform {
    const mapping: Record<string, Platform> = {
      meta: Platform.FACEBOOK,
      twitter: Platform.TWITTER,
      linkedin: Platform.LINKEDIN,
      tiktok: Platform.TIKTOK,
      pinterest: Platform.PINTEREST,
    };
    return mapping[platform] || Platform.FACEBOOK;
  }
}
