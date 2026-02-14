import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Role hierarchy: ADMIN > EDITOR > VIEWER
    const roleHierarchy: Record<Role, number> = {
      ADMIN: 3,
      EDITOR: 2,
      VIEWER: 1,
    };

    const userRoleLevel = roleHierarchy[user.role as Role] || 0;

    return requiredRoles.some(
      (role) => userRoleLevel >= roleHierarchy[role],
    );
  }
}
