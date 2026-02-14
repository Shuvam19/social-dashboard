import { IsOptional, IsString, IsDateString, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
