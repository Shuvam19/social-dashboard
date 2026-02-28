import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InteractionsService } from './interactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { InteractionType, Platform } from '@prisma/client';

@ApiTags('interactions')
@Controller('interactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InteractionsController {
  constructor(private interactionsService: InteractionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all interactions (inbox)' })
  @ApiQuery({ name: 'type', enum: InteractionType, required: false })
  @ApiQuery({ name: 'platform', enum: Platform, required: false })
  @ApiQuery({ name: 'isReplied', type: Boolean, required: false })
  @ApiQuery({ name: 'isRead', type: Boolean, required: false })
  @ApiQuery({ name: 'isHidden', type: Boolean, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: InteractionType,
    @Query('platform') platform?: Platform,
    @Query('isReplied') isReplied?: boolean,
    @Query('isRead') isRead?: boolean,
    @Query('isHidden') isHidden?: boolean,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.interactionsService.findAll(user.tenantId, {
      type,
      platform,
      isReplied,
      isRead,
      isHidden,
      search,
      limit,
      offset,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get inbox statistics' })
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.interactionsService.getStats(user.tenantId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread interaction count' })
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.interactionsService.getUnreadCount(user.tenantId);
    return { count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific interaction with thread' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.findOne(id, user.tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark interaction as read' })
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.markAsRead(id, user.tenantId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all interactions as read' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.interactionsService.markAllAsRead(user.tenantId);
  }

  @Patch(':id/replied')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Mark interaction as replied' })
  async markAsReplied(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.markAsReplied(id, user.tenantId);
  }

  @Post(':id/reply')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Reply to an interaction' })
  async reply(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { replyText: string },
  ) {
    // For now, just mark as replied. Platform-specific reply
    // will be implemented when integrating platform reply APIs.
    // TODO: Phase 3 — use PlatformClientFactory to send reply to platform
    return this.interactionsService.markAsReplied(id, user.tenantId);
  }

  @Patch(':id/hide')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Hide an interaction' })
  async hide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.hide(id, user.tenantId);
  }

  @Patch(':id/unhide')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Unhide an interaction' })
  async unhide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.unhide(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Delete an interaction (soft delete)' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.delete(id, user.tenantId);
  }
}
