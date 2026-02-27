import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformClient,
  TokenResponse,
  UserProfile,
  PostResult,
} from './platform-client.interface';

@Injectable()
export class TikTokClient implements PlatformClient {
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl = 'https://www.tiktok.com/v2/auth/authorize';
  private readonly tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
  private readonly apiUrl = 'https://open.tiktokapis.com/v2';

  constructor(private configService: ConfigService) {
    this.clientKey = this.configService.get('TIKTOK_CLIENT_KEY', '');
    this.clientSecret = this.configService.get('TIKTOK_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get('TIKTOK_REDIRECT_URI', '');
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_key: this.clientKey,
      redirect_uri: this.redirectUri,
      scope: 'user.info.basic,video.publish',
      response_type: 'code',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || 'Failed to exchange code');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || 'Failed to refresh token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(
      `${this.apiUrl}/user/info/?fields=open_id,union_id,avatar_url,display_name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to get user profile');
    }

    const user = data.data.user;
    return {
      id: user.open_id,
      username: user.display_name,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      metadata: {
        unionId: user.union_id,
      },
    };
  }

  async publishPost(accessToken: string, content: string, mediaUrls?: string[], postType?: string): Promise<PostResult> {
    // TikTok requires video content, text-only posts are not supported
    // This is a placeholder for the video publishing workflow
    throw new Error(
      'TikTok requires video content. Text-only posts are not supported.',
    );
  }
}
