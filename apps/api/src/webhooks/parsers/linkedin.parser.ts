import { InteractionType } from '@prisma/client';
import { WebhookParseResult, ParsedInteraction } from './parser.interface';

/**
 * Parses LinkedIn webhook payloads.
 *
 * LinkedIn uses organization-level webhooks for comments and reactions.
 * Event format:
 * {
 *   eventType: "ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS",
 *   resourceUrn: "urn:li:comment:123",
 *   ...
 * }
 *
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/social-action-notifications-api
 */
export function parseLinkedInPayload(payload: any): WebhookParseResult {
  const interactions: ParsedInteraction[] = [];

  // LinkedIn can send single event or batch
  const events = Array.isArray(payload) ? payload : [payload];
  let eventType = 'linkedin_webhook';

  for (const event of events) {
    eventType = event.eventType || 'linkedin_unknown';

    // Comment notifications
    if (event.eventType === 'ORGANIZATION_SOCIAL_ACTION_NOTIFICATIONS') {
      const parsed = parseLinkedInSocialAction(event, payload);
      if (parsed) interactions.push(parsed);
    }

    // Direct message / conversation events
    if (event.eventType === 'MESSAGING') {
      const parsed = parseLinkedInMessage(event, payload);
      if (parsed) interactions.push(parsed);
    }
  }

  return { interactions, eventType };
}

function parseLinkedInSocialAction(
  event: any,
  rawPayload: any,
): ParsedInteraction | null {
  const actionType = event.actionType; // COMMENT, LIKE, SHARE, etc
  if (actionType !== 'COMMENT') return null;

  // Extract organization ID from the resource URN
  const orgUrn = event.organizationUrn || '';
  const orgId = orgUrn.split(':').pop() || '';

  // Extract post ID from the object URN
  const objectUrn = event.objectUrn || '';
  const postId = objectUrn.split(':').pop() || '';

  const actor = event.actor || {};
  const actorId = (actor.urn || '').split(':').pop() || 'unknown';

  return {
    platformUserId: orgId,
    platformPostId: postId,
    type: event.parentCommentUrn ? InteractionType.REPLY : InteractionType.COMMENT,
    platformInteractionId: event.commentUrn?.split(':').pop() || `li_${Date.now()}`,
    senderId: actorId,
    senderName: actor.name || `LinkedIn User ${actorId}`,
    senderAvatarUrl: actor.pictureUrl,
    messageText: event.commentText || '',
    parentPlatformInteractionId: event.parentCommentUrn?.split(':').pop(),
    receivedAt: event.createdAt ? new Date(event.createdAt) : new Date(),
    rawPayload,
  };
}

function parseLinkedInMessage(
  event: any,
  rawPayload: any,
): ParsedInteraction | null {
  const orgUrn = event.organizationUrn || event.recipientUrn || '';
  const orgId = orgUrn.split(':').pop() || '';

  const sender = event.from || event.sender || {};
  const senderId = (sender.urn || '').split(':').pop() || 'unknown';

  return {
    platformUserId: orgId,
    type: InteractionType.DM,
    platformInteractionId: event.messageUrn?.split(':').pop() || `li_dm_${Date.now()}`,
    senderId,
    senderName: sender.name || `LinkedIn User ${senderId}`,
    senderAvatarUrl: sender.pictureUrl,
    messageText: event.messageText || event.body?.text || '',
    receivedAt: event.createdAt ? new Date(event.createdAt) : new Date(),
    rawPayload,
  };
}
