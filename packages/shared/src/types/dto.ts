import {
  Platform,
  Role,
  PostStatus,
  InteractionType,
  CampaignStatus,
  CampaignObjective,
  BudgetType,
} from './enums.js';

// ============== User DTOs ==============

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

// ============== Tenant DTOs ==============

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
}

export interface TenantMembershipDto {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  user?: UserDto;
  tenant?: TenantDto;
  createdAt: string;
}

// ============== Social Account DTOs ==============

export interface SocialAccountDto {
  id: string;
  tenantId: string;
  platform: Platform;
  platformUserId: string;
  platformUsername: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  connectedAt: string;
  tokenExpiresAt?: string;
}

export interface ConnectAccountDto {
  platform: Platform;
  code: string;
  redirectUri: string;
}

export interface DisconnectAccountDto {
  accountId: string;
}

// ============== Post DTOs ==============

export interface PostDto {
  id: string;
  tenantId: string;
  socialAccountId: string;
  socialAccount?: SocialAccountDto;
  contentText: string;
  mediaUrls: string[];
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  platformPostId?: string;
  platformPostUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostDto {
  socialAccountIds: string[];
  contentText: string;
  mediaUrls?: string[];
  scheduledAt?: string;
}

export interface UpdatePostDto {
  contentText?: string;
  mediaUrls?: string[];
  scheduledAt?: string;
}

// ============== Interaction DTOs ==============

export interface InteractionDto {
  id: string;
  postId: string;
  post?: PostDto;
  type: InteractionType;
  platformInteractionId: string;
  senderName: string;
  senderId: string;
  senderAvatarUrl?: string;
  messageText: string;
  sentimentScore?: number;
  isReplied: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReplyToInteractionDto {
  interactionId: string;
  replyText: string;
}

// ============== Campaign DTOs ==============

export interface CampaignDto {
  id: string;
  tenantId: string;
  socialAccountId: string;
  socialAccount?: SocialAccountDto;
  platformCampaignId?: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  budgetType: BudgetType;
  budgetAmount: number; // In cents/micros
  currency: string;
  startDate: string;
  endDate?: string;
  metrics?: CampaignMetricsDto;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMetricsDto {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

export interface CreateCampaignDto {
  socialAccountId: string;
  postId?: string; // For "Boost Post" functionality
  name: string;
  objective: CampaignObjective;
  budgetType: BudgetType;
  budgetAmount: number;
  currency: string;
  startDate: string;
  endDate?: string;
}

// ============== API Response DTOs ==============

export interface PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiErrorDto {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

// ============== OAuth DTOs ==============

export interface OAuthStateDto {
  platform: Platform;
  tenantId: string;
  userId: string;
  redirectUrl: string;
}

export interface OAuthCallbackDto {
  code: string;
  state: string;
}
