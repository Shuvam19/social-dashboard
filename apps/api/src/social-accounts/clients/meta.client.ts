import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformClient,
  TokenResponse,
  UserProfile,
  PostResult,
} from './platform-client.interface';

@Injectable()
export class MetaClient implements PlatformClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
  private readonly graphUrl = 'https://graph.facebook.com/v18.0';

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get('META_APP_ID', '');
    this.appSecret = this.configService.get('META_APP_SECRET', '');
    this.redirectUri = this.configService.get('META_REDIRECT_URI', '');
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish',
      response_type: 'code',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const response = await fetch(
      `${this.graphUrl}/oauth/access_token?${params.toString()}`,
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to exchange code');
    }

    // Exchange for long-lived token
    const longLivedResponse = await fetch(
      `${this.graphUrl}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: data.access_token,
        }),
    );

    const longLivedData = await longLivedResponse.json();

    return {
      accessToken: longLivedData.access_token || data.access_token,
      expiresAt: longLivedData.expires_in
        ? new Date(Date.now() + longLivedData.expires_in * 1000)
        : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    // Meta uses long-lived tokens, refresh by getting a new long-lived token
    const response = await fetch(
      `${this.graphUrl}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: refreshToken,
        }),
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to refresh token');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(
      `${this.graphUrl}/me?fields=id,name,email,picture&access_token=${accessToken}`,
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to get user profile');
    }

    return {
      id: data.id,
      username: data.email || data.id,
      displayName: data.name,
      avatarUrl: data.picture?.data?.url,
      metadata: {
        email: data.email,
      },
    };
  }

  async publishPost(accessToken: string, content: string): Promise<PostResult> {
    // For Facebook Pages posting
    // First get the user's pages
    const pagesResponse = await fetch(
      `${this.graphUrl}/me/accounts?access_token=${accessToken}`,
    );
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook Pages found for this account');
    }

    // Use the first page
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;

    const response = await fetch(`${this.graphUrl}/${page.id}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        access_token: pageAccessToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to publish post');
    }

    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id}`,
    };
  }
}
