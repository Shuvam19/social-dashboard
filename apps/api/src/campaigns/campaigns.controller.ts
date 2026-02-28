import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { CampaignStatus } from '@prisma/client';

@ApiTags('campaigns')
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all ad campaigns' })
  @ApiQuery({ name: 'status', enum: CampaignStatus, required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: CampaignStatus,
  ) {
    return this.campaignsService.findAll(user.tenantId, status);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get metrics summary across all campaigns' })
  async getSummary(@CurrentUser() user: JwtPayload) {
    return this.campaignsService.getMetricsSummary(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific campaign' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.campaignsService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles('PUBLISHER')
  @ApiOperation({ summary: 'Create a new ad campaign' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createCampaignDto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(user.tenantId, createCampaignDto);
  }
}
