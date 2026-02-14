export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PostResult {
  platformPostId: string;
  platformPostUrl?: string;
}

export interface PlatformClient {
  /**
   * Get the OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string): Promise<TokenResponse>;

  /**
   * Refresh an expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>;

  /**
   * Get the authenticated user's profile
   */
  getUserProfile(accessToken: string): Promise<UserProfile>;

  /**
   * Publish a text post
   */
  publishPost(
    accessToken: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<PostResult>;
}
