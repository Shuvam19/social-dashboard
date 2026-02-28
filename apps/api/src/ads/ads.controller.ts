import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdsService } from './ads.service';
import {
  CreateAdCampaignDto,
  BoostPostDto,
  UpdateCampaignStatusDto,
  SyncCampaignsDto,
} from './dto/ads.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { CampaignStatus } from '@prisma/client';

@ApiTags('ads')
@Controller('ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdsController {
  constructor(private adsService: AdsService) {}

  // ============== Campaigns ==============

  @Get('campaigns')
  @ApiOperation({ summary: 'Get all ad campaigns' })
  @ApiQuery({ name: 'status', enum: CampaignStatus, required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: CampaignStatus,
  ) {
    return this.adsService.findAll(user.tenantId, status);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get campaign detail with ad sets and ads' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.adsService.findOne(id, user.tenantId);
  }

  @Post('campaigns')
  @Roles('PUBLISHER')
  @ApiOperation({ summary: 'Create a new ad campaign' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdCampaignDto,
  ) {
    return this.adsService.create(user.tenantId, dto);
  }

  @Patch('campaigns/:id/status')
  @Roles('PUBLISHER')
  @ApiOperation({ summary: 'Update campaign status (activate, pause, etc.)' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.adsService.updateStatus(id, user.tenantId, dto);
  }

  @Delete('campaigns/:id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Delete a campaign' })
  async deleteCampaign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.adsService.deleteCampaign(id, user.tenantId);
  }

  // ============== Sync ==============

  @Post('campaigns/sync')
  @Roles('PUBLISHER')
  @ApiOperation({ summary: 'Sync campaigns from Meta' })
  async syncCampaigns(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SyncCampaignsDto,
  ) {
    return this.adsService.syncCampaigns(user.tenantId, dto.socialAccountId);
  }

  // ============== Boost ==============

  @Post('boost')
  @Roles('PUBLISHER')
  @ApiOperation({ summary: 'Boost an existing published post' })
  async boostPost(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BoostPostDto,
  ) {
    return this.adsService.boostPost(user.tenantId, dto);
  }

  // ============== Ad Sets & Ads ==============

  @Get('campaigns/:id/adsets')
  @ApiOperation({ summary: 'Get ad sets for a campaign' })
  async getAdSets(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.adsService.getAdSets(id, user.tenantId);
  }

  @Get('campaigns/:id/ads')
  @ApiOperation({ summary: 'Get all ads for a campaign' })
  async getAds(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.adsService.getAds(id, user.tenantId);
  }
}
