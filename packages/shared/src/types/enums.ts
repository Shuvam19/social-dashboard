// Social Media Platforms
export enum Platform {
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
  TIKTOK = 'tiktok',
  PINTEREST = 'pinterest',
}

// User Roles for RBAC
export enum Role {
  OWNER = 'OWNER',
  PUBLISHER = 'PUBLISHER',
  EDITOR = 'EDITOR',
  ANALYST = 'ANALYST',
}

// Fine-grained Permissions
export enum Permission {
  CONNECT_TOKENS = 'CONNECT_TOKENS',
  PUBLISH_YOUTUBE = 'PUBLISH_YOUTUBE',
  PUBLISH_FACEBOOK = 'PUBLISH_FACEBOOK',
  PUBLISH_INSTAGRAM = 'PUBLISH_INSTAGRAM',
  PUBLISH_LINKEDIN = 'PUBLISH_LINKEDIN',
  PUBLISH_TWITTER = 'PUBLISH_TWITTER',
  PUBLISH_TIKTOK = 'PUBLISH_TIKTOK',
  PUBLISH_PINTEREST = 'PUBLISH_PINTEREST',
  EDIT_CAPTIONS = 'EDIT_CAPTIONS',
  SCHEDULE = 'SCHEDULE',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  APPROVE_POSTS = 'APPROVE_POSTS',
  MANAGE_CAMPAIGNS = 'MANAGE_CAMPAIGNS',
}

// Audit Log Actions
export enum AuditAction {
  STORE_LINKED = 'STORE_LINKED',
  STORE_UNLINKED = 'STORE_UNLINKED',
  DEFAULTS_CHANGED = 'DEFAULTS_CHANGED',
  POST_CREATED = 'POST_CREATED',
  POST_UPDATED = 'POST_UPDATED',
  POST_PUBLISHED = 'POST_PUBLISHED',
  POST_SUBMITTED_FOR_REVIEW = 'POST_SUBMITTED_FOR_REVIEW',
  POST_APPROVED = 'POST_APPROVED',
  POST_REJECTED = 'POST_REJECTED',
  POST_SCHEDULED = 'POST_SCHEDULED',
  POST_DELETED = 'POST_DELETED',
  MEMBER_INVITED = 'MEMBER_INVITED',
  MEMBER_ROLE_CHANGED = 'MEMBER_ROLE_CHANGED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_PERMISSIONS_CHANGED = 'MEMBER_PERMISSIONS_CHANGED',
  TOKEN_CONNECTED = 'TOKEN_CONNECTED',
}

// Post Status
export enum PostStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

// Interaction Types
export enum InteractionType {
  COMMENT = 'comment',
  REPLY = 'reply',
  DM = 'dm',
  MENTION = 'mention',
  REVIEW = 'review',
}

// Ad Campaign Status
export enum CampaignStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

// Ad Campaign Objective
export enum CampaignObjective {
  TRAFFIC = 'traffic',
  AWARENESS = 'awareness',
  ENGAGEMENT = 'engagement',
  LEADS = 'leads',
  SALES = 'sales',
}

// Budget Type
export enum BudgetType {
  DAILY = 'daily',
  LIFETIME = 'lifetime',
}

// Ad Status (for Ad Sets and Ads)
export enum AdStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DELETED = 'deleted',
  REJECTED = 'rejected',
}

// Metric Entity Type (for granular metrics)
export enum MetricEntityType {
  CAMPAIGN = 'campaign',
  AD_SET = 'ad_set',
  AD = 'ad',
}

