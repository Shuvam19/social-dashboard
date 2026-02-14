import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { EncryptionService } from '../config/encryption.service';
import { Platform } from '@prisma/client';

@Injectable()
export class SocialAccountsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async findAll(tenantId: string) {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        connectedAt: true,
        tokenExpiresAt: true,
        metadata: true,
      },
    });

    return accounts;
  }

  async findById(id: string, tenantId: string) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        connectedAt: true,
        tokenExpiresAt: true,
        metadata: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return account;
  }

  async findByPlatform(tenantId: string, platform: Platform) {
    return this.prisma.socialAccount.findMany({
      where: { tenantId, platform, isActive: true },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        platformUsername: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        connectedAt: true,
        tokenExpiresAt: true,
      },
    });
  }

  async getDecryptedTokens(accountId: string) {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return {
      accessToken: this.encryption.decrypt(account.accessToken),
      refreshToken: account.refreshToken
        ? this.encryption.decrypt(account.refreshToken)
        : null,
      tokenExpiresAt: account.tokenExpiresAt,
    };
  }

  async updateTokens(
    accountId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
  ) {
    return this.prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: this.encryption.encrypt(accessToken),
        refreshToken: refreshToken
          ? this.encryption.encrypt(refreshToken)
          : undefined,
        tokenExpiresAt: expiresAt,
      },
    });
  }

  async disconnect(id: string, tenantId: string) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    // Soft delete - just mark as inactive
    return this.prisma.socialAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createOrUpdate(
    tenantId: string,
    platform: Platform,
    platformUserId: string,
    data: {
      platformUsername: string;
      displayName: string;
      avatarUrl?: string;
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      metadata?: object;
    },
  ) {
    const encryptedAccessToken = this.encryption.encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken
      ? this.encryption.encrypt(data.refreshToken)
      : null;

    return this.prisma.socialAccount.upsert({
      where: {
        tenantId_platform_platformUserId: {
          tenantId,
          platform,
          platformUserId,
        },
      },
      create: {
        tenantId,
        platform,
        platformUserId,
        platformUsername: data.platformUsername,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        metadata: data.metadata || {},
        isActive: true,
      },
      update: {
        platformUsername: data.platformUsername,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        metadata: data.metadata || {},
        isActive: true,
      },
    });
  }
}
