import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

const SUPPORTED_PLATFORMS = ['meta', 'twitter', 'linkedin', 'tiktok', 'pinterest'] as const;
type WebhookPlatform = (typeof SUPPORTED_PLATFORMS)[number];

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private configService: ConfigService,
    @InjectQueue('webhook-ingest') private webhookQueue: Queue,
  ) {}

  /**
   * GET /webhooks/:platform
   * Handles verification challenges from social platforms.
   * Meta requires hub.challenge response; Twitter uses CRC token.
   */
  @Get(':platform')
  @ApiOperation({ summary: 'Webhook verification endpoint' })
  async verifyWebhook(
    @Param('platform') platform: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    if (!this.isSupportedPlatform(platform)) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Unsupported platform' });
    }

    this.logger.log(`Verification request for ${platform}`);

    switch (platform) {
      case 'meta': {
        // Meta/Instagram hub challenge verification
        const mode = query['hub.mode'];
        const token = query['hub.verify_token'];
        const challenge = query['hub.challenge'];

        const verifyToken = this.configService.get<string>('META_WEBHOOK_VERIFY_TOKEN');

        if (mode === 'subscribe' && token === verifyToken) {
          this.logger.log('Meta webhook verified successfully');
          return res.status(HttpStatus.OK).send(challenge);
        }

        this.logger.warn('Meta webhook verification failed');
        return res.status(HttpStatus.FORBIDDEN).json({ error: 'Verification failed' });
      }

      case 'twitter': {
        // Twitter CRC token verification
        const crcToken = query['crc_token'];
        const consumerSecret = this.configService.get<string>('TWITTER_WEBHOOK_SECRET');

        if (crcToken && consumerSecret) {
          const hmac = crypto
            .createHmac('sha256', consumerSecret)
            .update(crcToken)
            .digest('base64');

          return res.status(HttpStatus.OK).json({
            response_token: `sha256=${hmac}`,
          });
        }

        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing crc_token' });
      }

      case 'linkedin':
      case 'tiktok':
      case 'pinterest': {
        // Generic challenge-response for other platforms
        const challenge = query['challenge'] || query['hub.challenge'];
        if (challenge) {
          return res.status(HttpStatus.OK).json({ challenge });
        }
        return res.status(HttpStatus.OK).json({ status: 'ok' });
      }

      default:
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'Unknown platform' });
    }
  }

  /**
   * POST /webhooks/:platform
   * Receives webhook payloads from social platforms.
   * Validates the signature, logs the event, and enqueues for async processing.
   */
  @Post(':platform')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook ingestion endpoint' })
  async receiveWebhook(
    @Param('platform') platform: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    if (!this.isSupportedPlatform(platform)) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Unsupported platform' });
    }

    const body = req.body;
    const rawBody = req.rawBody;

    this.logger.log(`Webhook received from ${platform}`);

    // Validate signature
    const isValid = this.validateSignature(platform, req.headers, rawBody);
    if (!isValid) {
      this.logger.warn(`Invalid webhook signature from ${platform}`);
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
    }

    try {
      // Enqueue immediately — respond fast to avoid platform timeouts
      await this.webhookQueue.add(
        `${platform}-webhook`,
        {
          platform,
          payload: body,
          headers: this.sanitizeHeaders(req.headers),
          receivedAt: new Date().toISOString(),
        },
        {
          // Use platform + a payload identifier for deduplication
          jobId: this.generateJobId(platform, body),
        },
      );

      this.logger.log(`Webhook from ${platform} enqueued successfully`);
      return res.status(HttpStatus.OK).json({ status: 'received' });
    } catch (error) {
      // If it's a duplicate job, that's fine
      if (error.message?.includes('Duplicate')) {
        this.logger.log(`Duplicate webhook from ${platform} ignored`);
        return res.status(HttpStatus.OK).json({ status: 'duplicate' });
      }

      this.logger.error(`Failed to enqueue webhook from ${platform}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Processing failed' });
    }
  }

  // ==========================================
  // Private helpers
  // ==========================================

  private isSupportedPlatform(platform: string): platform is WebhookPlatform {
    return SUPPORTED_PLATFORMS.includes(platform as WebhookPlatform);
  }

  private validateSignature(
    platform: string,
    headers: Record<string, any>,
    rawBody?: Buffer,
  ): boolean {
    // In development, skip signature validation if no secret is configured
    const isDev = this.configService.get('NODE_ENV') !== 'production';

    switch (platform) {
      case 'meta': {
        const signature = headers['x-hub-signature-256'];
        const appSecret = this.configService.get<string>('META_APP_SECRET');

        if (!appSecret) return isDev; // Skip in dev if not configured
        if (!signature || !rawBody) return false;

        const expectedSig =
          'sha256=' +
          crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSig),
        );
      }

      case 'twitter': {
        const signature = headers['x-twitter-webhooks-signature'];
        const consumerSecret = this.configService.get<string>('TWITTER_WEBHOOK_SECRET');

        if (!consumerSecret) return isDev;
        if (!signature || !rawBody) return false;

        const expectedSig =
          'sha256=' +
          crypto.createHmac('sha256', consumerSecret).update(rawBody).digest('base64');

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSig),
        );
      }

      case 'linkedin': {
        // LinkedIn uses a shared secret for signature validation
        const signature = headers['x-li-signature'];
        const secret = this.configService.get<string>('LINKEDIN_WEBHOOK_SECRET');

        if (!secret) return isDev;
        if (!signature || !rawBody) return false;

        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(rawBody)
          .digest('hex');

        return signature === expectedSig;
      }

      case 'tiktok': {
        // TikTok uses X-Tiktok-Signature
        const signature = headers['x-tiktok-signature'];
        const secret = this.configService.get<string>('TIKTOK_WEBHOOK_SECRET');

        if (!secret) return isDev;
        if (!signature || !rawBody) return false;

        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(rawBody)
          .digest('hex');

        return signature === expectedSig;
      }

      case 'pinterest': {
        // Pinterest webhook validation
        const signature = headers['x-pinterest-signature'];
        const secret = this.configService.get<string>('PINTEREST_WEBHOOK_SECRET');

        if (!secret) return isDev;
        if (!signature || !rawBody) return false;

        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(rawBody)
          .digest('hex');

        return signature === expectedSig;
      }

      default:
        return false;
    }
  }

  private generateJobId(platform: string, payload: any): string | undefined {
    // Try to extract a unique identifier from the payload to prevent duplicates
    try {
      if (platform === 'meta' && payload?.entry?.[0]?.id) {
        return `meta_${payload.entry[0].id}_${payload.entry[0].time}`;
      }
      if (platform === 'twitter' && payload?.for_user_id) {
        const eventId =
          payload.tweet_create_events?.[0]?.id_str ||
          payload.direct_message_events?.[0]?.id ||
          Date.now();
        return `twitter_${payload.for_user_id}_${eventId}`;
      }
    } catch {
      // Fall through — no dedup
    }
    return undefined; // Let BullMQ auto-generate
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const safe: Record<string, string> = {};
    const allowedHeaders = [
      'content-type',
      'x-hub-signature-256',
      'x-twitter-webhooks-signature',
      'x-li-signature',
      'x-tiktok-signature',
      'x-pinterest-signature',
      'user-agent',
    ];

    for (const key of allowedHeaders) {
      if (headers[key]) {
        safe[key] = String(headers[key]);
      }
    }

    return safe;
  }
}
