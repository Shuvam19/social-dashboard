import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/auth.interface';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload & { role: string; permissions: string[] }> {
    // Verify user exists and has access to tenant
    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: payload.sub,
          tenantId: payload.tenantId,
        },
      },
      include: {
        user: true,
        permissions: true,
      },
    });

    if (!membership || !membership.user.isActive) {
      throw new UnauthorizedException();
    }

    return {
      ...payload,
      role: membership.role,
      permissions: membership.permissions.map((p) => p.permission),
    };
  }
}
