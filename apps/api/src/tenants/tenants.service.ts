import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_PERMISSIONS } from '../auth/auth.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { Role, Permission, AuditAction } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, createTenantDto: CreateTenantDto) {
    // Check if slug is unique
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: createTenantDto.slug },
    });

    if (existing) {
      throw new ConflictException('Slug already in use');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: createTenantDto,
      });

      // Add creator as OWNER
      const membership = await tx.tenantMembership.create({
        data: {
          userId,
          tenantId: tenant.id,
          role: 'OWNER',
        },
      });

      // Seed default permissions for OWNER
      const ownerPermissions = DEFAULT_PERMISSIONS.OWNER;
      await tx.memberPermission.createMany({
        data: ownerPermissions.map((permission) => ({
          membershipId: membership.id,
          permission,
        })),
      });

      return tenant;
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            socialAccounts: true,
            posts: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto, userId?: string) {
    if (updateTenantDto.slug) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          slug: updateTenantDto.slug,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Slug already in use');
      }
    }

    const result = await this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });

    if (userId) {
      this.auditService.log({
        tenantId: id,
        userId,
        action: AuditAction.DEFAULTS_CHANGED,
        entityType: 'Tenant',
        entityId: id,
        metadata: { changedFields: Object.keys(updateTenantDto) },
      });
    }

    return result;
  }

  async inviteMember(tenantId: string, inviteMemberDto: InviteMemberDto, invitedByUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: inviteMemberDto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found with that email');
    }

    const existingMembership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: { userId: user.id, tenantId },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member');
    }

    // Determine permissions: use provided or defaults for role
    const permissionsToSeed: Permission[] = inviteMemberDto.permissions?.length
      ? inviteMemberDto.permissions
      : DEFAULT_PERMISSIONS[inviteMemberDto.role] || [];

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          role: inviteMemberDto.role,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Seed permissions
      if (permissionsToSeed.length > 0) {
        await tx.memberPermission.createMany({
          data: permissionsToSeed.map((permission) => ({
            membershipId: membership.id,
            permission,
          })),
        });
      }

      return membership;
    });

    if (invitedByUserId) {
      this.auditService.log({
        tenantId,
        userId: invitedByUserId,
        action: AuditAction.MEMBER_INVITED,
        entityType: 'TenantMembership',
        entityId: result.id,
        metadata: {
          email: inviteMemberDto.email,
          role: inviteMemberDto.role,
          permissions: permissionsToSeed,
        },
      });
    }

    return result;
  }

  async updateMemberRole(tenantId: string, memberId: string, role: Role, updatedByUserId?: string) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: memberId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    const oldRole = membership.role;

    // Update role and reset permissions to defaults for new role
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantMembership.update({
        where: { id: memberId },
        data: { role },
      });

      // Remove old permissions and seed new defaults
      await tx.memberPermission.deleteMany({
        where: { membershipId: memberId },
      });

      const newPermissions = DEFAULT_PERMISSIONS[role] || [];
      if (newPermissions.length > 0) {
        await tx.memberPermission.createMany({
          data: newPermissions.map((permission) => ({
            membershipId: memberId,
            permission,
          })),
        });
      }

      return updated;
    });

    if (updatedByUserId) {
      this.auditService.log({
        tenantId,
        userId: updatedByUserId,
        action: AuditAction.MEMBER_ROLE_CHANGED,
        entityType: 'TenantMembership',
        entityId: memberId,
        metadata: { oldRole, newRole: role },
      });
    }

    return result;
  }

  async updateMemberPermissions(
    tenantId: string,
    memberId: string,
    permissions: Permission[],
    updatedByUserId?: string,
  ) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundException('Membership not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove all existing permissions
      await tx.memberPermission.deleteMany({
        where: { membershipId: memberId },
      });

      // Create new permissions
      if (permissions.length > 0) {
        await tx.memberPermission.createMany({
          data: permissions.map((permission) => ({
            membershipId: memberId,
            permission,
          })),
        });
      }
    });

    if (updatedByUserId) {
      this.auditService.log({
        tenantId,
        userId: updatedByUserId,
        action: AuditAction.MEMBER_PERMISSIONS_CHANGED,
        entityType: 'TenantMembership',
        entityId: memberId,
        metadata: { permissions },
      });
    }

    return this.prisma.tenantMembership.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
        permissions: true,
      },
    });
  }

  async removeMember(tenantId: string, memberId: string, currentUserId: string) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: memberId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Prevent removing yourself if you're the last owner
    if (membership.userId === currentUserId) {
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId, role: 'OWNER' },
      });

      if (ownerCount === 1 && membership.role === 'OWNER') {
        throw new ForbiddenException('Cannot remove the last owner');
      }
    }

    const result = await this.prisma.tenantMembership.delete({
      where: { id: memberId },
    });

    this.auditService.log({
      tenantId,
      userId: currentUserId,
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'TenantMembership',
      entityId: memberId,
      metadata: { removedUserId: membership.userId, role: membership.role },
    });

    return result;
  }

  async getMembers(tenantId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        permissions: true,
      },
    });
  }
}
