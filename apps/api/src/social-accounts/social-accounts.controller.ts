import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SocialAccountsService } from './social-accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { Platform } from '@prisma/client';

@ApiTags('social-accounts')
@Controller('social-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SocialAccountsController {
  constructor(private socialAccountsService: SocialAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all connected social accounts' })
  @ApiQuery({ name: 'platform', enum: Platform, required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('platform') platform?: Platform,
  ) {
    if (platform) {
      return this.socialAccountsService.findByPlatform(user.tenantId, platform);
    }
    return this.socialAccountsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific social account' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.socialAccountsService.findById(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Disconnect a social account' })
  async disconnect(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.socialAccountsService.disconnect(id, user.tenantId);
  }
}
