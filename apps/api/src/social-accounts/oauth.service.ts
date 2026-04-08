import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../config/redis.service';
import { SocialAccountsService } from './social-accounts.service';
import { PlatformClientFactory } from './clients/platform-client.factory';

export interface OAuthState {
  platform: Platform;
  tenantId: string;
  userId: string;
  nonce: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private socialAccountsService: SocialAccountsService,
    private platformClientFactory: PlatformClientFactory,
  ) {}

  async getAuthorizationUrl(
    platform: Platform,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const state: OAuthState = {
      platform,
      tenantId,
      userId,
      nonce: uuidv4(),
    };

    // Store state in Redis for 10 minutes
    await this.redisService.setJSON(
      `oauth:state:${state.nonce}`,
      state,
      600,
    );

    const client = this.platformClientFactory.getClient(platform);
    return client.getAuthorizationUrl(state.nonce);
  }

  async handleCallback(
    platform: Platform,
    code: string,
    state: string,
  ): Promise<{ success: boolean; accountId: string }> {
    // Verify state
    const storedState = await this.redisService.getJSON<OAuthState>(
      `oauth:state:${state}`,
    );

    if (!storedState || storedState.platform.toLowerCase() !== platform.toLowerCase()) {
      throw new BadRequestException('Invalid OAuth state');
    }

    // Delete state to prevent replay
    await this.redisService.del(`oauth:state:${state}`);

    // Exchange code for tokens
    const client = this.platformClientFactory.getClient(platform);
    const tokenResponse = await client.exchangeCodeForTokens(code);

    // Get user profile
    const profile = await client.getUserProfile(tokenResponse.accessToken);

    // Save account
    const account = await this.socialAccountsService.createOrUpdate(
      storedState.tenantId,
      platform,
      profile.id,
      {
        platformUsername: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        tokenExpiresAt: tokenResponse.expiresAt,
        metadata: profile.metadata,
      },
    );

    return { success: true, accountId: account.id };
  }

  async refreshAccessToken(accountId: string): Promise<void> {
    const account = await this.socialAccountsService.getDecryptedTokens(accountId);

    if (!account.refreshToken) {
      throw new BadRequestException('No refresh token available');
    }

    // Get platform from account
    const accountData = await this.socialAccountsService.findById(accountId, '');
    const client = this.platformClientFactory.getClient(accountData.platform);

    const newTokens = await client.refreshAccessToken(account.refreshToken);

    await this.socialAccountsService.updateTokens(
      accountId,
      newTokens.accessToken,
      newTokens.refreshToken,
      newTokens.expiresAt,
    );
  }
}
