import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { PostStatus } from '@prisma/client';

@ApiTags('posts')
@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @Roles('EDITOR')
  @RequirePermissions('EDIT_CAPTIONS')
  @ApiOperation({ summary: 'Create a new post for one or more accounts' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create(user.tenantId, createPostDto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posts' })
  @ApiQuery({ name: 'status', enum: PostStatus, required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: PostStatus,
  ) {
    return this.postsService.findAll(user.tenantId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific post' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('EDITOR')
  @RequirePermissions('EDIT_CAPTIONS')
  @ApiOperation({ summary: 'Update a post' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user.tenantId, updatePostDto);
  }

  @Delete(':id')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Delete a post' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postsService.delete(id, user.tenantId, user.sub);
  }

  @Post(':id/publish')
  @Roles('PUBLISHER')
  @ApiOperation({ summary: 'Publish a post immediately' })
  async publish(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postsService.publishNow(id, user.tenantId, user.sub, user.role);
  }

  // ============== Approval Workflow ==============

  @Post(':id/submit-review')
  @Roles('EDITOR')
  @ApiOperation({ summary: 'Submit a draft post for review' })
  async submitForReview(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postsService.submitForReview(id, user.tenantId, user.sub);
  }

  @Post(':id/approve')
  @Roles('PUBLISHER')
  @RequirePermissions('APPROVE_POSTS')
  @ApiOperation({ summary: 'Approve a post pending review' })
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.postsService.approvePost(id, user.tenantId, user.sub, note);
  }

  @Post(':id/reject')
  @Roles('PUBLISHER')
  @RequirePermissions('APPROVE_POSTS')
  @ApiOperation({ summary: 'Reject a post pending review' })
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    return this.postsService.rejectPost(id, user.tenantId, user.sub, note);
  }
}
