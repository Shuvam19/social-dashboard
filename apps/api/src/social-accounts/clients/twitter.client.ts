import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformClient,
  TokenResponse,
  UserProfile,
  PostResult,
} from './platform-client.interface';

@Injectable()
export class TwitterClient implements PlatformClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl = 'https://api.twitter.com/2';
  private readonly authUrl = 'https://twitter.com/i/oauth2/authorize';

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get('TWITTER_CLIENT_ID', '');
    this.clientSecret = this.configService.get('TWITTER_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get('TWITTER_REDIRECT_URI', '');
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: 'challenge', // In production, use PKCE
      code_challenge_method: 'plain',
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code_verifier: 'challenge',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || 'Failed to exchange code');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || 'Failed to refresh token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(`${this.baseUrl}/users/me?user.fields=profile_image_url,name,username`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to get user profile');
    }

    return {
      id: data.data.id,
      username: data.data.username,
      displayName: data.data.name,
      avatarUrl: data.data.profile_image_url,
      metadata: {
        verified: data.data.verified,
      },
    };
  }

  async publishPost(accessToken: string, content: string): Promise<PostResult> {
    const response = await fetch(`${this.baseUrl}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to publish tweet');
    }

    return {
      platformPostId: data.data.id,
      platformPostUrl: `https://twitter.com/i/status/${data.data.id}`,
    };
  }
}
