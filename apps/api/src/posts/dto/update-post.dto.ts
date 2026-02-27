import { IsOptional, IsString, IsDateString, IsArray, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus, PostType } from '@prisma/client';

export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Updated content text' })
  @IsOptional()
  @IsString()
  contentText?: string;

  @ApiPropertyOptional({ description: 'Updated media URLs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @ApiPropertyOptional({ description: 'Type of post: TEXT, PHOTO, VIDEO, or REEL', enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  postType?: PostType;

  @ApiPropertyOptional({ description: 'Updated schedule time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Post status', enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
