import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { Role } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

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

      // Add creator as admin
      await tx.tenantMembership.create({
        data: {
          userId,
          tenantId: tenant.id,
          role: 'ADMIN',
        },
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

  async update(id: string, updateTenantDto: UpdateTenantDto) {
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

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async inviteMember(tenantId: string, inviteMemberDto: InviteMemberDto) {
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

    return this.prisma.tenantMembership.create({
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
  }

  async updateMemberRole(tenantId: string, memberId: string, role: Role) {
    return this.prisma.tenantMembership.update({
      where: { id: memberId },
      data: { role },
    });
  }

  async removeMember(tenantId: string, memberId: string, currentUserId: string) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: memberId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Prevent removing yourself if you're the last admin
    if (membership.userId === currentUserId) {
      const adminCount = await this.prisma.tenantMembership.count({
        where: { tenantId, role: 'ADMIN' },
      });

      if (adminCount === 1 && membership.role === 'ADMIN') {
        throw new ForbiddenException('Cannot remove the last admin');
      }
    }

    return this.prisma.tenantMembership.delete({
      where: { id: memberId },
    });
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
      },
    });
  }
}
