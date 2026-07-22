import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

@Injectable()
export class PeriodGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenantId: string; periodId?: string }>();
    const periodId = request.headers['x-period-id'];

    if (!periodId || typeof periodId !== 'string') {
      throw new BadRequestException('Missing required x-period-id header. Select a period before managing master data.');
    }

    const period = await this.prisma.period.findFirst({ where: { id: periodId, tenantId: request.tenantId } });

    if (!period) {
      throw new NotFoundException('Period not found for this tenant');
    }

    if (MUTATING_METHODS.includes(request.method) && period.status === 'locked') {
      throw new BadRequestException('This period is locked. Master data cannot be modified.');
    }

    request.periodId = periodId;
    return true;
  }
}
