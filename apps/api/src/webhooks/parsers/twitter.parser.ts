import { InteractionType } from '@prisma/client';
import { WebhookParseResult, ParsedInteraction } from './parser.interface';

/**
 * Parses Twitter/X Account Activity API webhook payloads.
 *
 * Twitter sends events like:
 * {
 *   for_user_id: "123",
 *   tweet_create_events: [...],
 *   direct_message_events: [...],
 *   ...
 * }
 *
 * @see https://developer.x.com/en/docs/twitter-api/enterprise/account-activity-api
 */
export function parseTwitterPayload(payload: any): WebhookParseResult {
  const interactions: ParsedInteraction[] = [];
  const userId = payload.for_user_id;
  let eventType = 'twitter_webhook';

  if (!userId) {
    return { interactions: [], eventType: 'twitter_unknown' };
  }

  // Handle tweet_create_events (mentions / replies)
  if (payload.tweet_create_events && Array.isArray(payload.tweet_create_events)) {
    eventType = 'twitter_tweet_create';
    for (const tweet of payload.tweet_create_events) {
      // Skip tweets from the account owner
      if (tweet.user?.id_str === userId) continue;

      const type = tweet.in_reply_to_status_id_str
        ? InteractionType.REPLY
        : InteractionType.MENTION;

      interactions.push({
        platformUserId: userId,
        platformPostId: tweet.in_reply_to_status_id_str,
        type,
        platformInteractionId: tweet.id_str,
        senderId: tweet.user?.id_str || 'unknown',
        senderName: tweet.user?.screen_name || tweet.user?.name || 'Unknown',
        senderAvatarUrl: tweet.user?.profile_image_url_https,
        messageText: tweet.text || tweet.full_text || '',
        parentPlatformInteractionId: tweet.in_reply_to_status_id_str,
        receivedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
        rawPayload: payload,
      });
    }
  }

  // Handle direct_message_events
  if (payload.direct_message_events && Array.isArray(payload.direct_message_events)) {
    eventType = 'twitter_direct_message';
    for (const dmEvent of payload.direct_message_events) {
      if (dmEvent.type !== 'message_create') continue;
      const msgData = dmEvent.message_create;

      // Skip DMs sent by the account owner
      if (msgData?.sender_id === userId) continue;

      const senderId = msgData?.sender_id || 'unknown';
      const senderUser = payload.users?.[senderId];

      interactions.push({
        platformUserId: userId,
        type: InteractionType.DM,
        platformInteractionId: dmEvent.id,
        senderId,
        senderName: senderUser?.screen_name || senderUser?.name || senderId,
        senderAvatarUrl: senderUser?.profile_image_url_https,
        messageText: msgData?.message_data?.text || '',
        receivedAt: dmEvent.created_timestamp
          ? new Date(parseInt(dmEvent.created_timestamp))
          : new Date(),
        rawPayload: payload,
      });
    }
  }

  return { interactions, eventType };
}
