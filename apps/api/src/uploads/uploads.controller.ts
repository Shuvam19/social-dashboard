import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/auth.interface';
import { S3Service } from '../config/s3.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UploadsController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('presigned-url')
  @Roles('ADMIN', 'EDITOR')
  @ApiOperation({
    summary: 'Generate a pre-signed URL for direct S3 upload',
    description:
      'Returns a pre-signed PUT URL that the client can use to upload a file directly to S3, bypassing the server. Also returns the public file URL to store after upload.',
  })
  async getPresignedUrl(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PresignedUrlDto,
  ) {
    const { uploadUrl, fileUrl } = await this.s3Service.generatePresignedUploadUrl(
      user.tenantId,
      dto.fileName,
      dto.contentType,
    );

    return { uploadUrl, fileUrl };
  }
}
