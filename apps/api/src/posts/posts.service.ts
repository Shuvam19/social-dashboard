import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { PlatformClientFactory } from '../social-accounts/clients/platform-client.factory';
import { AuditService } from '../audit/audit.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostStatus, AuditAction } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private socialAccountsService: SocialAccountsService,
    private platformClientFactory: PlatformClientFactory,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, createPostDto: CreatePostDto, userId?: string) {
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
            createdById: userId,
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

    // Audit log
    if (userId) {
      for (const post of posts) {
        this.auditService.log({
          tenantId,
          userId,
          action: AuditAction.POST_CREATED,
          entityType: 'Post',
          entityId: post.id,
          metadata: {
            platform: post.socialAccount.platform,
            status: post.status,
          },
        });
      }
    }

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

  async delete(id: string, tenantId: string, userId?: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Cannot delete a published post');
    }

    const result = await this.prisma.post.delete({ where: { id } });

    if (userId) {
      this.auditService.log({
        tenantId,
        userId,
        action: AuditAction.POST_DELETED,
        entityType: 'Post',
        entityId: id,
      });
    }

    return result;
  }

  // ============== Approval Workflow ==============

  async submitForReview(id: string, tenantId: string, userId: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status !== PostStatus.DRAFT) {
      throw new BadRequestException('Only draft posts can be submitted for review');
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.PENDING_REVIEW },
      include: {
        socialAccount: {
          select: { id: true, platform: true, displayName: true, avatarUrl: true },
        },
      },
    });

    this.auditService.log({
      tenantId,
      userId,
      action: AuditAction.POST_SUBMITTED_FOR_REVIEW,
      entityType: 'Post',
      entityId: id,
      metadata: { platform: updated.socialAccount.platform },
    });

    return updated;
  }

  async approvePost(id: string, tenantId: string, reviewerId: string, note?: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status !== PostStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only posts pending review can be approved');
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.APPROVED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
      include: {
        socialAccount: {
          select: { id: true, platform: true, displayName: true, avatarUrl: true },
        },
      },
    });

    this.auditService.log({
      tenantId,
      userId: reviewerId,
      action: AuditAction.POST_APPROVED,
      entityType: 'Post',
      entityId: id,
      metadata: { note, platform: updated.socialAccount.platform },
    });

    return updated;
  }

  async rejectPost(id: string, tenantId: string, reviewerId: string, note: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status !== PostStatus.PENDING_REVIEW) {
      throw new BadRequestException('Only posts pending review can be rejected');
    }

    if (!note) {
      throw new BadRequestException('A rejection note is required');
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.DRAFT,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
      include: {
        socialAccount: {
          select: { id: true, platform: true, displayName: true, avatarUrl: true },
        },
      },
    });

    this.auditService.log({
      tenantId,
      userId: reviewerId,
      action: AuditAction.POST_REJECTED,
      entityType: 'Post',
      entityId: id,
      metadata: { note, platform: updated.socialAccount.platform },
    });

    return updated;
  }

  // ============== Publishing ==============

  async publishNow(id: string, tenantId: string, userId?: string, userRole?: string) {
    const post = await this.findOne(id, tenantId);

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Post is already published');
    }

    // Only APPROVED posts (or DRAFT/SCHEDULED by OWNER) can be published
    const allowedStatuses: PostStatus[] = [PostStatus.APPROVED, PostStatus.SCHEDULED];
    if (userRole === 'OWNER') {
      allowedStatuses.push(PostStatus.DRAFT);
    }

    if (!allowedStatuses.includes(post.status)) {
      throw new ForbiddenException(
        'Post must be approved before publishing. Submit it for review first.',
      );
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
      const publishedPost = await this.prisma.post.update({
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

      // Audit log: post published
      if (userId) {
        this.auditService.log({
          tenantId,
          userId,
          action: AuditAction.POST_PUBLISHED,
          entityType: 'Post',
          entityId: id,
          metadata: {
            platform: publishedPost.socialAccount.platform,
            platformPostId: result.platformPostId,
            platformPostUrl: result.platformPostUrl,
            apiResponse: result,
          },
        });
      }

      return publishedPost;
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
