import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const PeriodId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { periodId: string }>();
  return request.periodId;
});
