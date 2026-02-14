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
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

// Post Status
export enum PostStatus {
  DRAFT = 'draft',
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
