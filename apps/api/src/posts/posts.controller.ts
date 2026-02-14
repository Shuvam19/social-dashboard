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
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { PostStatus } from '@prisma/client';

@ApiTags('posts')
@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Create a new post for one or more accounts' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create(user.tenantId, createPostDto);
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
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Update a post' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user.tenantId, updatePostDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Delete a post' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postsService.delete(id, user.tenantId);
  }

  @Post(':id/publish')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Publish a post immediately' })
  async publish(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.postsService.publishNow(id, user.tenantId);
  }
}
