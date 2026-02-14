import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
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
import { InteractionType } from '@prisma/client';

@ApiTags('interactions')
@Controller('interactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InteractionsController {
  constructor(private interactionsService: InteractionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all interactions (inbox)' })
  @ApiQuery({ name: 'type', enum: InteractionType, required: false })
  @ApiQuery({ name: 'isReplied', type: Boolean, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: InteractionType,
    @Query('isReplied') isReplied?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.interactionsService.findAll(user.tenantId, {
      type,
      isReplied,
      limit,
      offset,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific interaction' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.findOne(id, user.tenantId);
  }

  @Patch(':id/replied')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Mark interaction as replied' })
  async markAsReplied(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.markAsReplied(id, user.tenantId);
  }

  @Patch(':id/hide')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Hide an interaction' })
  async hide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.hide(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Delete an interaction (soft delete)' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.interactionsService.delete(id, user.tenantId);
  }
}
