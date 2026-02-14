import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformClient,
  TokenResponse,
  UserProfile,
  PostResult,
} from './platform-client.interface';

@Injectable()
export class PinterestClient implements PlatformClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl = 'https://www.pinterest.com/oauth';
  private readonly apiUrl = 'https://api.pinterest.com/v5';

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get('PINTEREST_APP_ID', '');
    this.appSecret = this.configService.get('PINTEREST_APP_SECRET', '');
    this.redirectUri = this.configService.get('PINTEREST_REDIRECT_URI', '');
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: 'boards:read,pins:read,pins:write,user_accounts:read',
      response_type: 'code',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await fetch(`${this.apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to exchange code');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(`${this.apiUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to refresh token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(`${this.apiUrl}/user_account`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user profile');
    }

    return {
      id: data.id,
      username: data.username,
      displayName: data.business_name || data.username,
      avatarUrl: data.profile_image,
      metadata: {
        accountType: data.account_type,
        websiteUrl: data.website_url,
      },
    };
  }

  async publishPost(accessToken: string, content: string): Promise<PostResult> {
    // Pinterest requires an image for pins
    // This is a placeholder - actual implementation would need board_id and media
    throw new Error(
      'Pinterest requires an image to create a Pin. Text-only posts are not supported.',
    );
  }
}
