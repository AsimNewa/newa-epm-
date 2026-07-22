import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { tenantId: string }>();
  return request.tenantId;
});
