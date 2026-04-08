import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, youtube_v3, Auth } from 'googleapis';
import {
  PlatformClient,
  PostResult,
  TokenResponse,
  UserProfile,
} from './platform-client.interface';
import { Readable } from 'stream';

@Injectable()
export class YouTubeClient implements PlatformClient {
  private readonly oauth2Client: Auth.OAuth2Client;
  private readonly youtube: youtube_v3.Youtube;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get('YOUTUBE_CLIENT_ID');
    const clientSecret = this.configService.get('YOUTUBE_CLIENT_SECRET');
    const redirectUri = this.configService.get('YOUTUBE_REDIRECT_URI');

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    this.youtube = google.youtube('v3');
  }

  getAuthorizationUrl(state: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: state,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : undefined,
        tokenType: tokens.token_type || 'Bearer',
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to exchange Google code: ${error.message}`,
      );
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : undefined,
        tokenType: credentials.token_type || 'Bearer',
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to refresh Google token: ${error.message}`,
      );
    }
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const response = await this.youtube.channels.list({
        auth: this.oauth2Client,
        part: ['snippet'],
        mine: true,
      });

      console.log(response);

      const items = response.data.items;
      if (!items || items.length === 0) {
        throw new BadRequestException('No YouTube channel found for this user.');
      }

      const channel = items[0];
      const snippet = channel.snippet!;

      return {
        id: channel.id!,
        username: snippet.customUrl || snippet.title || channel.id!,
        displayName: snippet.title || 'YouTube Channel',
        avatarUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
        metadata: {
          description: snippet.description,
          publishedAt: snippet.publishedAt,
        },
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to fetch YouTube profile: ${error.message}`,
      );
    }
  }

  async publishPost(
    accessToken: string,
    content: string,
    mediaUrls?: string[],
    postType?: string,
  ): Promise<PostResult> {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new BadRequestException('YouTube requires a video file to upload.');
    }

    if (postType !== 'VIDEO' && postType !== 'REEL') {
      throw new BadRequestException('YouTube only supports VIDEO or REEL post types.');
    }

    const videoUrl = mediaUrls[0];

    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      // Fetch the video from URL as a stream
      const response = await fetch(videoUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const stream = Readable.fromWeb(response.body as any);

      let title = content.split('\n')[0] || 'Untitled Video';
      if (title.length > 100) {
        title = title.substring(0, 97) + '...';
      }

      let description = content;

      if (postType === 'REEL') {
        if (!description.toLowerCase().includes('#shorts')) {
          description += '\n#Shorts';
        }
      }

      const res = await this.youtube.videos.insert({
        auth: this.oauth2Client,
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title,
            description: description,
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: stream,
        },
      });

      return {
        platformPostId: res.data.id!,
        platformPostUrl: `https://www.youtube.com/watch?v=${res.data.id}`,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to upload video to YouTube: ${error.message}`,
      );
    }
  }
}
