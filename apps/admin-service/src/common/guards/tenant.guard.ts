import { CanActivate, ExecutionContext, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenantId?: string }>();
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId || typeof tenantId !== 'string') {
      throw new BadRequestException('Missing required x-tenant-id header');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant || tenant.status !== 'active') {
      throw new NotFoundException('Tenant not found or inactive');
    }

    request.tenantId = tenantId;
    return true;
  }
}
