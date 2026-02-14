import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PlatformClient } from './platform-client.interface';
import { TwitterClient } from './twitter.client';
import { LinkedInClient } from './linkedin.client';
import { MetaClient } from './meta.client';
import { TikTokClient } from './tiktok.client';
import { PinterestClient } from './pinterest.client';

@Injectable()
export class PlatformClientFactory {
  constructor(
    private twitterClient: TwitterClient,
    private linkedInClient: LinkedInClient,
    private metaClient: MetaClient,
    private tikTokClient: TikTokClient,
    private pinterestClient: PinterestClient,
  ) {}

  getClient(platform: Platform): PlatformClient {
    switch (platform) {
      case Platform.TWITTER:
        return this.twitterClient;
      case Platform.LINKEDIN:
        return this.linkedInClient;
      case Platform.FACEBOOK:
      case Platform.INSTAGRAM:
        return this.metaClient;
      case Platform.TIKTOK:
        return this.tikTokClient;
      case Platform.PINTEREST:
        return this.pinterestClient;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}
