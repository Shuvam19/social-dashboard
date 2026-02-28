import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './config/prisma.module';
import { RedisModule } from './config/redis.module';
import { S3Module } from './config/s3.module';
import { BullConfigModule } from './config/bull.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { SocialAccountsModule } from './social-accounts/social-accounts.module';
import { PostsModule } from './posts/posts.module';
import { InteractionsModule } from './interactions/interactions.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AdsModule } from './ads/ads.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { InboxModule } from './inbox/inbox.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Infrastructure
    PrismaModule,
    RedisModule,
    S3Module,
    BullConfigModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    SocialAccountsModule,
    PostsModule,
    InteractionsModule,
    CampaignsModule,
    AdsModule,
    AnalyticsModule,
    WebhooksModule,
    InboxModule,
    UploadsModule,
  ],
})
export class AppModule {}
