import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/constants/roles.constants';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: User role not found');
    }

    // Role hierarchy: admin has access to everything; 'both' has rider + driver roles
    const hasRole = requiredRoles.some((role) => {
      if (user.role === UserRole.admin) return true;
      if (user.role === role) return true;
      if (user.role === UserRole.both && (role === UserRole.rider || role === UserRole.driver)) {
        return true;
      }
      return false;
    });

    if (!hasRole) {
      throw new ForbiddenException(`User role '${user.role}' is not authorized for this resource`);
    }

    return true;
  }
}
