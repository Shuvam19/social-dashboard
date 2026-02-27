import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { PlatformClientFactory } from '../social-accounts/clients/platform-client.factory';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostStatus } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private socialAccountsService: SocialAccountsService,
    private platformClientFactory: PlatformClientFactory,
  ) {}

  async create(tenantId: string, createPostDto: CreatePostDto) {
    const { socialAccountIds, contentText, mediaUrls, scheduledAt, postType } = createPostDto;

    // Validate all social accounts belong to the tenant
    const accounts = await this.prisma.socialAccount.findMany({
      where: {
        id: { in: socialAccountIds },
        tenantId,
        isActive: true,
      },
    });

    if (accounts.length !== socialAccountIds.length) {
      throw new BadRequestException('One or more social accounts are invalid');
    }

    // Create posts for each account
    const posts = await this.prisma.$transaction(
      socialAccountIds.map((socialAccountId) =>
        this.prisma.post.create({
          data: {
            tenantId,
            socialAccountId,
            contentText,
            mediaUrls: mediaUrls || [],
            postType: postType || 'TEXT',
            status: scheduledAt ? PostStatus.SCHEDULED : PostStatus.DRAFT,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          },
          include: {
            socialAccount: {
              select: {
                id: true,
                platform: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        }),
      ),
    );

    return posts;
  }

  async findAll(tenantId: string, status?: PostStatus) {
    return this.prisma.post.findMany({
      where: {
        tenantId,
        ...(status && { status }),
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, tenantId },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async update(id: string, tenantId: string, updatePostDto: UpdatePostDto) {
    const post = await this.findOne(id, tenantId);

    // Only allow updates for draft/scheduled posts
    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Cannot update a published post');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        ...updatePostDto,
        scheduledAt: updatePostDto.scheduledAt
          ? new Date(updatePostDto.scheduledAt)
          : undefined,
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Cannot delete a published post');
    }

    return this.prisma.post.delete({ where: { id } });
  }

  async publishNow(id: string, tenantId: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Post is already published');
    }

    // Update status to publishing
    await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.PUBLISHING },
    });

    try {
      // Get decrypted tokens
      const tokens = await this.socialAccountsService.getDecryptedTokens(
        post.socialAccountId,
      );

      // Get platform client
      const client = this.platformClientFactory.getClient(post.socialAccount.platform);

      // Publish the post
      const result = await client.publishPost(
        tokens.accessToken,
        post.contentText,
        post.mediaUrls,
        post.postType,
      );

      // Update post with success
      return this.prisma.post.update({
        where: { id },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          platformPostId: result.platformPostId,
          platformPostUrl: result.platformPostUrl,
        },
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });
    } catch (error) {
      // Update post with failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.post.update({
        where: { id },
        data: {
          status: PostStatus.FAILED,
          errorMessage,
        },
      });

      throw new BadRequestException(`Failed to publish: ${errorMessage}`);
    }
  }
}
