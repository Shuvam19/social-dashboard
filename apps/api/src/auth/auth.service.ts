import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Permission, Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../config/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, AuthTokens, AuthResponse } from './interfaces/auth.interface';

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: Object.values(Permission) as Permission[], // All permissions
  PUBLISHER: [
    Permission.PUBLISH_YOUTUBE,
    Permission.PUBLISH_FACEBOOK,
    Permission.PUBLISH_INSTAGRAM,
    Permission.PUBLISH_LINKEDIN,
    Permission.PUBLISH_TWITTER,
    Permission.PUBLISH_TIKTOK,
    Permission.PUBLISH_PINTEREST,
    Permission.EDIT_CAPTIONS,
    Permission.SCHEDULE,
    Permission.VIEW_ANALYTICS,
    Permission.APPROVE_POSTS,
    Permission.MANAGE_CAMPAIGNS,
  ],
  EDITOR: [
    Permission.EDIT_CAPTIONS,
    Permission.VIEW_ANALYTICS,
  ],
  ANALYST: [
    Permission.VIEW_ANALYTICS,
  ],
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    // Create user and default tenant in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          passwordHash,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
        },
      });

      // Create default tenant (personal workspace)
      const tenant = await tx.tenant.create({
        data: {
          name: `${registerDto.firstName}s Workspace`,
          slug: `${registerDto.firstName.toLowerCase()}-${uuidv4().slice(0, 8)}`,
        },
      });

      // Create membership with OWNER role
      const membership = await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'OWNER',
          isDefault: true,
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

      return { user, tenant, permissions: ownerPermissions };
    });

    const tokens = await this.generateTokens(result.user.id, result.tenant.id);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      role: 'OWNER',
      permissions: result.permissions as string[],
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // Get default tenant with permissions
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id, isDefault: true },
      include: { tenant: true, permissions: true },
    });

    if (!membership) {
      throw new UnauthorizedException('No workspace found');
    }

    const tokens = await this.generateTokens(user.id, membership.tenantId);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
      },
      role: membership.role,
      permissions: membership.permissions.map((p) => p.permission),
      ...tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    return user;
  }

  async generateTokens(userId: string, tenantId: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, tenantId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    ]);

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Verify token exists in DB
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Delete old refresh token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // Generate new tokens
      return this.generateTokens(payload.sub, payload.tenantId);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async switchTenant(userId: string, tenantId: string): Promise<AuthTokens & { role: string; permissions: string[] }> {
    // Verify user has access to tenant
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: { userId, tenantId },
      },
      include: { permissions: true },
    });

    if (!membership) {
      throw new UnauthorizedException('No access to this workspace');
    }

    const tokens = await this.generateTokens(userId, tenantId);
    return {
      ...tokens,
      role: membership.role,
      permissions: membership.permissions.map((p) => p.permission),
    };
  }
}
