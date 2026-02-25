import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { MetaAdsClient } from './clients/meta-ads.client';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';

@Module({
  imports: [SocialAccountsModule],
  controllers: [AdsController],
  providers: [AdsService, MetaAdsClient],
  exports: [AdsService, MetaAdsClient],
})
export class AdsModule {}
