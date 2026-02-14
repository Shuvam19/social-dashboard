import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignObjective, BudgetType } from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty({ description: 'Social account to run the campaign on' })
  @IsUUID()
  @IsNotEmpty()
  socialAccountId: string;

  @ApiPropertyOptional({ description: 'Post to boost (optional)' })
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
  @Min(100) // Minimum $1.00
  budgetAmount: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
