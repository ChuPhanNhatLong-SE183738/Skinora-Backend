import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    this.logger.debug('User object in roles guard:', JSON.stringify(user));
    
    if (!user) {
      this.logger.warn('No user found in request');
      return false;
    }

    // Support multiple ways that roles might be stored in the token
    const userRole = user.role?.toLowerCase();
    const userRoles = Array.isArray(user.roles) 
      ? user.roles.map(r => r.toLowerCase())
      : [];

    // Check individual role or roles array
    const hasRequiredRole = requiredRoles.some(role => {
      const normalizedRole = role.toLowerCase();
      return (
        userRole === normalizedRole ||
        userRoles.includes(normalizedRole)
      );
    });
    
    this.logger.debug(`Role check: ${hasRequiredRole}. Required: [${requiredRoles.join(', ')}], User has: ${userRole || 'none'}, [${userRoles.join(', ')}]`);
    
    return hasRequiredRole;
  }
}
