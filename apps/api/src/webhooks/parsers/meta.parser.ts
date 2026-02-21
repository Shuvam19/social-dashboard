import { InteractionType } from '@prisma/client';
import { WebhookParseResult, ParsedInteraction } from './parser.interface';

/**
 * Parses Meta (Facebook/Instagram) webhook payloads.
 *
 * Meta sends webhook events in this format:
 * {
 *   object: "page" | "instagram",
 *   entry: [{
 *     id: "page_id",
 *     time: 1234567890,
 *     changes: [{ field: "feed", value: { ... } }],
 *     messaging: [{ sender: {}, message: {} }]
 *   }]
 * }
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks
 */
export function parseMetaPayload(payload: any): WebhookParseResult {
  const interactions: ParsedInteraction[] = [];
  const objectType = payload.object; // 'page' (FB) or 'instagram'

  if (!payload.entry || !Array.isArray(payload.entry)) {
    return { interactions: [], eventType: `${objectType}_unknown` };
  }

  for (const entry of payload.entry) {
    const pageId = entry.id;
    const timestamp = entry.time ? new Date(entry.time * 1000) : new Date();

    // Handle feed changes (comments on posts)
    if (entry.changes && Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === 'feed' && change.value) {
          const parsed = parseMetaFeedChange(change.value, pageId, timestamp, payload);
          if (parsed) interactions.push(parsed);
        }

        // Instagram comments
        if (change.field === 'comments' && change.value) {
          const parsed = parseMetaComment(change.value, pageId, timestamp, payload);
          if (parsed) interactions.push(parsed);
        }

        // Instagram mentions
        if (change.field === 'mentions' && change.value) {
          const parsed = parseMetaMention(change.value, pageId, timestamp, payload);
          if (parsed) interactions.push(parsed);
        }
      }
    }

    // Handle messaging (DMs)
    if (entry.messaging && Array.isArray(entry.messaging)) {
      for (const msg of entry.messaging) {
        const parsed = parseMetaMessage(msg, pageId, timestamp, payload);
        if (parsed) interactions.push(parsed);
      }
    }
  }

  return {
    interactions,
    eventType: `${objectType}_webhook`,
  };
}

function parseMetaFeedChange(
  value: any,
  pageId: string,
  timestamp: Date,
  rawPayload: any,
): ParsedInteraction | null {
  // Only process comments
  if (value.item !== 'comment') return null;

  const type = value.parent_id ? InteractionType.REPLY : InteractionType.COMMENT;

  return {
    platformUserId: pageId,
    platformPostId: value.post_id,
    type,
    platformInteractionId: value.comment_id,
    senderId: value.from?.id || 'unknown',
    senderName: value.from?.name || 'Unknown User',
    senderAvatarUrl: value.from?.id
      ? `https://graph.facebook.com/${value.from.id}/picture?type=square`
      : undefined,
    messageText: value.message || '',
    parentPlatformInteractionId: value.parent_id,
    receivedAt: timestamp,
    rawPayload,
  };
}

function parseMetaComment(
  value: any,
  pageId: string,
  timestamp: Date,
  rawPayload: any,
): ParsedInteraction | null {
  return {
    platformUserId: pageId,
    platformPostId: value.media?.id,
    type: InteractionType.COMMENT,
    platformInteractionId: value.id,
    senderId: value.from?.id || 'unknown',
    senderName: value.from?.username || value.from?.name || 'Unknown User',
    senderAvatarUrl: value.from?.profile_picture_url,
    messageText: value.text || '',
    receivedAt: timestamp,
    rawPayload,
  };
}

function parseMetaMention(
  value: any,
  pageId: string,
  timestamp: Date,
  rawPayload: any,
): ParsedInteraction | null {
  return {
    platformUserId: pageId,
    platformPostId: value.media_id,
    type: InteractionType.MENTION,
    platformInteractionId: value.comment_id || `mention_${Date.now()}`,
    senderId: value.from?.id || 'unknown',
    senderName: value.from?.username || 'Unknown User',
    messageText: value.text || `Mentioned in a ${objectType(value)} post`,
    receivedAt: timestamp,
    rawPayload,
  };
}

function objectType(value: any): string {
  return value.media_type || 'media';
}

function parseMetaMessage(
  msg: any,
  pageId: string,
  timestamp: Date,
  rawPayload: any,
): ParsedInteraction | null {
  // Skip echo messages (sent by the page itself)
  if (msg.message?.is_echo) return null;

  const sender = msg.sender;
  if (!sender?.id) return null;

  return {
    platformUserId: pageId,
    type: InteractionType.DM,
    platformInteractionId: msg.message?.mid || `dm_${Date.now()}`,
    senderId: sender.id,
    senderName: sender.name || sender.id,
    messageText: msg.message?.text || '[Attachment]',
    receivedAt: msg.timestamp ? new Date(msg.timestamp) : timestamp,
    rawPayload,
  };
}
