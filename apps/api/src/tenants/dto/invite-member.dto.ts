import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'newmember@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: Role, example: 'EDITOR' })
  @IsEnum(Role)
  role: Role;
}
