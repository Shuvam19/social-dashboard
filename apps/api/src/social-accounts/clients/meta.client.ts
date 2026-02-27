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
      scope: 'public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,publish_video,instagram_basic,instagram_content_publish',
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

  async publishPost(
    accessToken: string,
    content: string,
    mediaUrls?: string[],
    postType?: string,
  ): Promise<PostResult> {
    // Get the user's Facebook Page
    const page = await this.getFirstPage(accessToken);
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    const type = postType || 'TEXT';
    const hasMedia = mediaUrls && mediaUrls.length > 0;

    // Validate media URLs are publicly accessible (not data URIs)
    if (hasMedia) {
      const dataUrls = mediaUrls.filter((url) => url.startsWith('data:'));
      if (dataUrls.length > 0) {
        throw new Error(
          'Media must be publicly accessible URLs (http/https). ' +
          'Data URLs are not supported by the Facebook API. ' +
          'Please upload your files to a storage service first.',
        );
      }
    }

    switch (type) {
      case 'REEL':
        return this.publishReel(pageId, pageAccessToken, content, mediaUrls);
      case 'VIDEO':
        return this.publishVideo(pageId, pageAccessToken, content, mediaUrls);
      case 'PHOTO':
        return this.publishPhoto(pageId, pageAccessToken, content, mediaUrls);
      case 'TEXT':
      default:
        // If media is present but type is TEXT, auto-detect
        if (hasMedia) {
          const firstUrl = mediaUrls[0].toLowerCase();
          if (firstUrl.match(/\.(mp4|mov|avi|wmv|flv|mkv|webm)(\?.*)?$/)) {
            return this.publishVideo(pageId, pageAccessToken, content, mediaUrls);
          }
          return this.publishPhoto(pageId, pageAccessToken, content, mediaUrls);
        }
        return this.publishTextPost(pageId, pageAccessToken, content);
    }
  }

  // ── Helper: Get first Facebook Page ────────────────────────────────────────

  private async getFirstPage(accessToken: string): Promise<{ id: string; access_token: string }> {
    const pagesResponse = await fetch(
      `${this.graphUrl}/me/accounts?access_token=${accessToken}`,
    );
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook Pages found for this account');
    }

    return pagesData.data[0];
  }

  // ── Text post ──────────────────────────────────────────────────────────────

  private async publishTextPost(
    pageId: string,
    pageAccessToken: string,
    content: string,
  ): Promise<PostResult> {
    const response = await fetch(`${this.graphUrl}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        access_token: pageAccessToken,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Failed to publish text post');
    }

    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id}`,
    };
  }

  // ── Photo post ─────────────────────────────────────────────────────────────

  private async publishPhoto(
    pageId: string,
    pageAccessToken: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<PostResult> {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('At least one image URL is required for a photo post');
    }

    if (mediaUrls.length === 1) {
      // Single photo post
      const response = await fetch(`${this.graphUrl}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaUrls[0],
          message: content,
          access_token: pageAccessToken,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Failed to publish photo');
      }

      return {
        platformPostId: data.post_id || data.id,
        platformPostUrl: `https://www.facebook.com/${data.post_id || data.id}`,
      };
    }

    // Multiple photos: upload each as unpublished, then create a multi-photo post
    const photoIds: string[] = [];

    for (const url of mediaUrls) {
      const response = await fetch(`${this.graphUrl}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          published: false,
          access_token: pageAccessToken,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Failed to upload photo');
      }
      photoIds.push(data.id);
    }

    // Create the multi-photo post
    const attachedMedia: Record<string, { media_fbid: string }> = {};
    photoIds.forEach((photoId, index) => {
      attachedMedia[`attached_media[${index}]`] = { media_fbid: photoId };
    });

    const feedBody: Record<string, unknown> = {
      message: content,
      access_token: pageAccessToken,
    };
    photoIds.forEach((photoId, index) => {
      feedBody[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photoId });
    });

    const params = new URLSearchParams();
    params.append('message', content);
    params.append('access_token', pageAccessToken);
    photoIds.forEach((photoId, index) => {
      params.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: photoId }));
    });

    const response = await fetch(`${this.graphUrl}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Failed to publish multi-photo post');
    }

    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id}`,
    };
  }

  // ── Video post ─────────────────────────────────────────────────────────────

  private async publishVideo(
    pageId: string,
    pageAccessToken: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<PostResult> {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('A video URL is required for a video post');
    }

    const response = await fetch(`${this.graphUrl}/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: mediaUrls[0],
        description: content,
        access_token: pageAccessToken,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Failed to publish video');
    }

    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${pageId}/videos/${data.id}`,
    };
  }

  // ── Reel ───────────────────────────────────────────────────────────────────

  private async publishReel(
    pageId: string,
    pageAccessToken: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<PostResult> {
    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('A video URL is required to create a Reel');
    }

    // Step 1: Initialize the reel upload
    const initResponse = await fetch(`${this.graphUrl}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'start',
        access_token: pageAccessToken,
      }),
    });

    const initData = await initResponse.json();
    if (initData.error) {
      throw new Error(initData.error.message || 'Failed to initialize Reel upload');
    }

    const videoId = initData.video_id;

    // Step 2: Upload the video by URL
    const uploadResponse = await fetch(
      `${this.graphUrl}/${videoId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_phase: 'transfer',
          file_url: mediaUrls[0],
          access_token: pageAccessToken,
        }),
      },
    );

    const uploadData = await uploadResponse.json();
    if (uploadData.error) {
      throw new Error(uploadData.error.message || 'Failed to upload Reel video');
    }

    // Step 3: Finish and publish the reel
    const finishResponse = await fetch(`${this.graphUrl}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
        description: content,
        access_token: pageAccessToken,
      }),
    });

    const finishData = await finishResponse.json();
    if (finishData.error) {
      throw new Error(finishData.error.message || 'Failed to publish Reel');
    }

    return {
      platformPostId: finishData.video_id || videoId,
      platformPostUrl: `https://www.facebook.com/reel/${finishData.video_id || videoId}`,
    };
  }
}
