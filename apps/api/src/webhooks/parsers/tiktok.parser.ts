import { InteractionType } from '@prisma/client';
import { WebhookParseResult, ParsedInteraction } from './parser.interface';

/**
 * Parses TikTok webhook payloads.
 *
 * TikTok webhook format:
 * {
 *   event: "comment.create",
 *   user_open_id: "...",
 *   content: { ... }
 * }
 *
 * @see https://developers.tiktok.com/doc/webhooks-overview
 */
export function parseTikTokPayload(payload: any): WebhookParseResult {
  const interactions: ParsedInteraction[] = [];
  const eventType = payload.event || 'tiktok_unknown';

  if (!payload.event) {
    return { interactions: [], eventType: 'tiktok_unknown' };
  }

  switch (payload.event) {
    case 'comment.create':
    case 'comment.reply': {
      const content = payload.content || {};
      const isReply = payload.event === 'comment.reply';

      interactions.push({
        platformUserId: payload.user_open_id || '',
        platformPostId: content.video_id,
        type: isReply ? InteractionType.REPLY : InteractionType.COMMENT,
        platformInteractionId: content.comment_id || `tt_${Date.now()}`,
        senderId: content.commenter?.user_id || 'unknown',
        senderName:
          content.commenter?.display_name ||
          content.commenter?.unique_id ||
          'TikTok User',
        senderAvatarUrl: content.commenter?.avatar_url,
        messageText: content.text || '',
        parentPlatformInteractionId: content.parent_comment_id,
        receivedAt: content.create_time
          ? new Date(content.create_time * 1000)
          : new Date(),
        rawPayload: payload,
      });
      break;
    }

    case 'direct_message.receive': {
      const content = payload.content || {};

      interactions.push({
        platformUserId: payload.user_open_id || '',
        type: InteractionType.DM,
        platformInteractionId: content.msg_id || `tt_dm_${Date.now()}`,
        senderId: content.sender?.user_id || 'unknown',
        senderName:
          content.sender?.display_name ||
          content.sender?.unique_id ||
          'TikTok User',
        senderAvatarUrl: content.sender?.avatar_url,
        messageText: content.text || '[Media]',
        receivedAt: content.send_time
          ? new Date(content.send_time * 1000)
          : new Date(),
        rawPayload: payload,
      });
      break;
    }

    case 'mention.create': {
      const content = payload.content || {};

      interactions.push({
        platformUserId: payload.user_open_id || '',
        platformPostId: content.video_id,
        type: InteractionType.MENTION,
        platformInteractionId: content.mention_id || `tt_mention_${Date.now()}`,
        senderId: content.from_user?.user_id || 'unknown',
        senderName:
          content.from_user?.display_name ||
          content.from_user?.unique_id ||
          'TikTok User',
        senderAvatarUrl: content.from_user?.avatar_url,
        messageText: content.text || 'Mentioned you in a video',
        receivedAt: new Date(),
        rawPayload: payload,
      });
      break;
    }
  }

  return { interactions, eventType };
}
