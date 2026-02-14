import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformClient,
  TokenResponse,
  UserProfile,
  PostResult,
} from './platform-client.interface';

@Injectable()
export class LinkedInClient implements PlatformClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  private readonly tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
  private readonly apiUrl = 'https://api.linkedin.com/v2';

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get('LINKEDIN_CLIENT_ID', '');
    this.clientSecret = this.configService.get('LINKEDIN_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get('LINKEDIN_REDIRECT_URI', '');
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'openid profile email w_member_social',
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
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
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
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
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
    const response = await fetch(`${this.apiUrl}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user profile');
    }

    return {
      id: data.sub,
      username: data.email,
      displayName: data.name,
      avatarUrl: data.picture,
      metadata: {
        email: data.email,
        emailVerified: data.email_verified,
      },
    };
  }

  async publishPost(accessToken: string, content: string): Promise<PostResult> {
    // First get the user's URN
    const profileResponse = await fetch(`${this.apiUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileResponse.json();
    const authorUrn = `urn:li:person:${profile.sub}`;

    // Create the post
    const response = await fetch(`${this.apiUrl}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to publish post');
    }

    const postId = data.id.replace('urn:li:share:', '');
    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.linkedin.com/feed/update/${data.id}`,
    };
  }
}
