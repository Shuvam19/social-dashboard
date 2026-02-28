import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlDto {
  @ApiProperty({ description: 'Original file name', example: 'photo.jpg' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(image\/(jpeg|jpg|png|gif|webp|svg\+xml)|video\/(mp4|mov|avi|webm|quicktime))$/, {
    message:
      'contentType must be a supported image or video MIME type (e.g., image/jpeg, image/png, video/mp4)',
  })
  contentType: string;
}
