import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { Permission } from '@prisma/client';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant/workspace' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createTenantDto: CreateTenantDto,
  ) {
    return this.tenantsService.create(user.sub, createTenantDto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant details' })
  async getCurrent(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.findById(user.tenantId);
  }

  @Patch('current')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update current tenant' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(user.tenantId, updateTenantDto, user.sub);
  }

  @Get('current/members')
  @ApiOperation({ summary: 'Get all members of current tenant' })
  async getMembers(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getMembers(user.tenantId);
  }

  @Post('current/members')
  @Roles('OWNER')
  @RequirePermissions('MANAGE_MEMBERS')
  @ApiOperation({ summary: 'Invite a member to current tenant' })
  async inviteMember(
    @CurrentUser() user: JwtPayload,
    @Body() inviteMemberDto: InviteMemberDto,
  ) {
    return this.tenantsService.inviteMember(user.tenantId, inviteMemberDto, user.sub);
  }

  @Patch('current/members/:memberId')
  @Roles('OWNER')
  @RequirePermissions('MANAGE_MEMBERS')
  @ApiOperation({ summary: 'Update member role' })
  async updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
  ) {
    return this.tenantsService.updateMemberRole(
      user.tenantId,
      memberId,
      updateMemberRoleDto.role,
      user.sub,
    );
  }

  @Patch('current/members/:memberId/permissions')
  @Roles('OWNER')
  @RequirePermissions('MANAGE_MEMBERS')
  @ApiOperation({ summary: 'Update member permissions' })
  async updateMemberPermissions(
    @CurrentUser() user: JwtPayload,
    @Param('memberId') memberId: string,
    @Body('permissions') permissions: Permission[],
  ) {
    return this.tenantsService.updateMemberPermissions(
      user.tenantId,
      memberId,
      permissions,
      user.sub,
    );
  }

  @Delete('current/members/:memberId')
  @Roles('OWNER')
  @RequirePermissions('MANAGE_MEMBERS')
  @ApiOperation({ summary: 'Remove a member from tenant' })
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('memberId') memberId: string,
  ) {
    return this.tenantsService.removeMember(user.tenantId, memberId, user.sub);
  }
}
