import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: 'IDs of social accounts to post to',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  socialAccountIds: string[];

  @ApiProperty({
    description: 'Post content text',
    example: 'Check out our new product launch! 🚀',
  })
  @IsString()
  @IsNotEmpty()
  contentText: string;

  @ApiPropertyOptional({
    description: 'Media URLs to attach',
    type: [String],
    example: ['https://example.com/image.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @ApiPropertyOptional({
    description: 'Schedule post for later (ISO 8601 format)',
    example: '2024-12-25T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
