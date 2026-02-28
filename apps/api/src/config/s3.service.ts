import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', 'test');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', 'test');
    const forcePathStyle = this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    this.bucket = this.configService.get<string>('S3_BUCKET', 'social-dashboard-uploads');
    this.publicUrl = this.configService.get<string>(
      'S3_PUBLIC_URL',
      `http://localhost:4566/${this.bucket}`,
    );

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    };

    // Only set endpoint if provided (LocalStack or custom S3-compatible storage)
    // For production AWS S3, leave S3_ENDPOINT unset
    if (endpoint) {
      clientConfig.endpoint = endpoint;
    }

    this.client = new S3Client(clientConfig);
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket "${this.bucket}" is accessible`);
    } catch (error) {
      this.logger.warn(
        `S3 bucket "${this.bucket}" is not accessible. Make sure it exists and credentials are correct. Error: ${error.message}`,
      );
    }
  }

  /**
   * Generate a pre-signed PUT URL for direct client-side upload.
   * Returns the upload URL and the public file URL.
   */
  async generatePresignedUploadUrl(
    tenantId: string,
    fileName: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${tenantId}/${uuidv4()}/${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300, // 5 minutes
    });

    const fileUrl = `${this.publicUrl}/${key}`;

    return { uploadUrl, fileUrl };
  }

  getS3Client(): S3Client {
    return this.client;
  }

  getBucket(): string {
    return this.bucket;
  }
}
