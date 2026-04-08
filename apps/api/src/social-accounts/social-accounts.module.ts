import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { SocialAccountsController } from './social-accounts.controller';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { EncryptionService } from '../config/encryption.service';
import { PlatformClientFactory } from './clients/platform-client.factory';
import { TwitterClient } from './clients/twitter.client';
import { LinkedInClient } from './clients/linkedin.client';
import { MetaClient } from './clients/meta.client';
import { TikTokClient } from './clients/tiktok.client';
import { PinterestClient } from './clients/pinterest.client';
import { YouTubeClient } from './clients/youtube.client';

@Module({
  controllers: [SocialAccountsController, OAuthController],
  providers: [
    SocialAccountsService,
    OAuthService,
    EncryptionService,
    PlatformClientFactory,
    TwitterClient,
    LinkedInClient,
    MetaClient,
    TikTokClient,
    PinterestClient,
    YouTubeClient,
  ],
  exports: [SocialAccountsService, PlatformClientFactory],
})
export class SocialAccountsModule {}
