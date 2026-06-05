import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { RoleUtilisateur } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { appHttpException } from '../../core/http/app-http.exception';

export const ROLES_KEY = 'roles';

interface AuthUser {
  role?: RoleUtilisateur;
}

interface HttpRequest {
  user?: AuthUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleUtilisateur[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const httpRequest = context.switchToHttp().getRequest<HttpRequest>();
    const userRole = httpRequest.user?.role;

    if (!userRole) {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }

    if (!requiredRoles.includes(userRole)) {
      throw appHttpException('AUTH_FORBIDDEN');
    }

    return true;
  }
}

export function Roles(...roles: RoleUtilisateur[]) {
  return (
    target: object,
    key: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value as object);
    return descriptor;
  };
}
