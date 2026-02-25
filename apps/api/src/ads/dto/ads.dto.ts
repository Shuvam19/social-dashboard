import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignObjective, BudgetType, CampaignStatus } from '@prisma/client';

export class CreateAdCampaignDto {
  @ApiProperty({ description: 'Social account ID (must be Meta platform)' })
  @IsUUID()
  @IsNotEmpty()
  socialAccountId: string;

  @ApiPropertyOptional({ description: 'Post ID to boost (optional)' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiProperty({ example: 'Summer Sale Campaign' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: CampaignObjective })
  @IsEnum(CampaignObjective)
  objective: CampaignObjective;

  @ApiProperty({ enum: BudgetType })
  @IsEnum(BudgetType)
  budgetType: BudgetType;

  @ApiProperty({ description: 'Budget amount in cents', example: 5000 })
  @IsNumber()
  @Min(100)
  budgetAmount: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Platform-specific targeting config' })
  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;
}

export class BoostPostDto {
  @ApiProperty({ description: 'Post ID to boost' })
  @IsUUID()
  @IsNotEmpty()
  postId: string;

  @ApiProperty({ description: 'Social account ID (Meta)' })
  @IsUUID()
  @IsNotEmpty()
  socialAccountId: string;

  @ApiPropertyOptional({ example: 'Boost: My Post' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Budget in cents', example: 2000 })
  @IsNumber()
  @Min(100)
  budgetAmount: number;

  @ApiProperty({ enum: BudgetType })
  @IsEnum(BudgetType)
  budgetType: BudgetType;

  @ApiProperty({ description: 'Duration in days', example: 7 })
  @IsNumber()
  @Min(1)
  @Max(90)
  duration: number;

  @ApiProperty({ enum: CampaignObjective })
  @IsEnum(CampaignObjective)
  objective: CampaignObjective;

  @ApiPropertyOptional({ description: 'Optional targeting' })
  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;
}

export class UpdateCampaignStatusDto {
  @ApiProperty({ enum: CampaignStatus })
  @IsEnum(CampaignStatus)
  status: CampaignStatus;
}

export class SyncCampaignsDto {
  @ApiProperty({ description: 'Social account ID to sync from' })
  @IsUUID()
  @IsNotEmpty()
  socialAccountId: string;
}
