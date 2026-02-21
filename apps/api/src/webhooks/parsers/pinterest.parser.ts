import { InteractionType } from '@prisma/client';
import { WebhookParseResult, ParsedInteraction } from './parser.interface';

/**
 * Parses Pinterest webhook payloads.
 *
 * Pinterest webhook format:
 * {
 *   event_type: "pin_comment",
 *   data: { ... }
 * }
 *
 * @see https://developers.pinterest.com/docs/api/v5/webhooks
 */
export function parsePinterestPayload(payload: any): WebhookParseResult {
  const interactions: ParsedInteraction[] = [];
  const eventType = payload.event_type || 'pinterest_unknown';

  if (!payload.event_type) {
    return { interactions: [], eventType: 'pinterest_unknown' };
  }

  const data = payload.data || {};

  switch (payload.event_type) {
    case 'pin_comment':
    case 'pin_reply': {
      const isReply = payload.event_type === 'pin_reply';

      interactions.push({
        platformUserId: data.owner_id || data.account_id || '',
        platformPostId: data.pin_id,
        type: isReply ? InteractionType.REPLY : InteractionType.COMMENT,
        platformInteractionId: data.comment_id || `pin_${Date.now()}`,
        senderId: data.commenter?.id || 'unknown',
        senderName: data.commenter?.username || data.commenter?.name || 'Pinterest User',
        senderAvatarUrl: data.commenter?.profile_image,
        messageText: data.text || '',
        parentPlatformInteractionId: data.parent_comment_id,
        receivedAt: data.created_at ? new Date(data.created_at) : new Date(),
        rawPayload: payload,
      });
      break;
    }

    case 'mention': {
      interactions.push({
        platformUserId: data.owner_id || data.account_id || '',
        platformPostId: data.pin_id,
        type: InteractionType.MENTION,
        platformInteractionId: data.mention_id || `pin_mention_${Date.now()}`,
        senderId: data.from_user?.id || 'unknown',
        senderName: data.from_user?.username || 'Pinterest User',
        senderAvatarUrl: data.from_user?.profile_image,
        messageText: data.text || 'Mentioned you in a Pin',
        receivedAt: new Date(),
        rawPayload: payload,
      });
      break;
    }

    case 'message': {
      interactions.push({
        platformUserId: data.recipient_id || data.account_id || '',
        type: InteractionType.DM,
        platformInteractionId: data.message_id || `pin_dm_${Date.now()}`,
        senderId: data.sender?.id || 'unknown',
        senderName: data.sender?.username || 'Pinterest User',
        senderAvatarUrl: data.sender?.profile_image,
        messageText: data.text || '[Media]',
        receivedAt: data.created_at ? new Date(data.created_at) : new Date(),
        rawPayload: payload,
      });
      break;
    }
  }

  return { interactions, eventType };
}
