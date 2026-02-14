import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role, example: 'EDITOR' })
  @IsEnum(Role)
  role: Role;
}
