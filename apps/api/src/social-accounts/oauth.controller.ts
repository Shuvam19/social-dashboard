import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { Platform } from '@prisma/client';

@ApiTags('oauth')
@Controller('oauth')
export class OAuthController {
  constructor(
    private oAuthService: OAuthService,
    private configService: ConfigService,
  ) {}

  @Get(':platform/authorize')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('OWNER')
  @RequirePermissions('CONNECT_TOKENS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get OAuth authorization URL for a platform' })
  async authorize(
    @CurrentUser() user: JwtPayload,
    @Param('platform') platform: Platform,
    @Res() res: Response,
  ) {
    const authUrl = await this.oAuthService.getAuthorizationUrl(
      platform,
      user.tenantId,
      user.sub,
    );

    // Return URL for frontend to redirect
    return res.json({ authorizationUrl: authUrl });
  }

  @Get(':platform/callback')
  @ApiOperation({ summary: 'OAuth callback endpoint' })
  async callback(
    @Param('platform') platform: Platform,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');

    if (error) {
      return res.redirect(
        `${frontendUrl}/accounts/connect?error=${encodeURIComponent(error)}`,
      );
    }

    try {
      const result = await this.oAuthService.handleCallback(platform, code, state);
      return res.redirect(
        `${frontendUrl}/accounts/connect?success=true&accountId=${result.accountId}`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return res.redirect(
        `${frontendUrl}/accounts/connect?error=${encodeURIComponent(errorMessage)}`,
      );
    }
  }
}
