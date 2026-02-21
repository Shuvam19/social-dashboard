import { InteractionType } from '@prisma/client';

/**
 * Normalized interaction data from webhook payload
 */
export interface ParsedInteraction {
  platformUserId: string; // The social account that received this interaction
  platformPostId?: string; // The post this interaction belongs to
  type: InteractionType;
  platformInteractionId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  messageText: string;
  parentPlatformInteractionId?: string; // For threaded replies
  receivedAt: Date;
  rawPayload: Record<string, unknown>;
}

/**
 * Result of parsing a webhook payload — can produce multiple interactions
 */
export interface WebhookParseResult {
  interactions: ParsedInteraction[];
  eventType: string;
}
