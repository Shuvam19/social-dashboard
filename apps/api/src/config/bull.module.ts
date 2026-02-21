import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600, // keep completed jobs for 24 hours
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 3600, // keep failed jobs for 7 days
          },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullConfigModule {}
