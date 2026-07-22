import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

type ScopedRequest = Request & {
  tenantId: string;
  userId?: string;
  entityScope?: string[] | null; // null = unrestricted; string[] = allowed entity IDs
  groupScope?: string[] | null; // null = unrestricted; string[] = allowed consolidation group IDs
};

@Injectable()
export class UserContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const userId = request.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
      // No acting-as user: unrestricted access (null = no filter applied)
      request.entityScope = null;
      request.groupScope = null;
      return true;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: request.tenantId, status: 'active' },
    });

    if (!user) {
      throw new NotFoundException('User not found or inactive');
    }

    request.userId = userId;

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
    });

    // Effective entity scope: null (unrestricted) if ANY role has empty entityScope, else union of all scopes.
    const hasUnrestrictedEntityAccess = userRoles.some((ur) => ur.entityScope.length === 0);
    request.entityScope = hasUnrestrictedEntityAccess
      ? null
      : [...new Set(userRoles.flatMap((ur) => ur.entityScope))];

    const hasUnrestrictedGroupAccess = userRoles.some((ur) => ur.groupScope.length === 0);
    request.groupScope = hasUnrestrictedGroupAccess
      ? null
      : [...new Set(userRoles.flatMap((ur) => ur.groupScope))];

    return true;
  }
}
