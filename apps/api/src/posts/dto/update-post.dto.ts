import { IsOptional, IsString, IsDateString, IsArray, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';

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

  @ApiPropertyOptional({ description: 'Updated schedule time' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Post status', enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
