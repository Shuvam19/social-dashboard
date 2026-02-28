import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, Permission } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'newmember@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: Role, example: 'EDITOR' })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    description: 'Fine-grained permissions. If omitted, defaults for the role are used.',
    enum: Permission,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
