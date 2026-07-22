import { ExecutionContext, BadRequestException, NotFoundException } from '@nestjs/common';
import { PeriodGuard } from './period.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('PeriodGuard', () => {
  let guard: PeriodGuard;
  let findFirst: jest.Mock;

  const createContext = (
    headers: Record<string, string>,
    request: Record<string, unknown> = {},
    method = 'GET',
  ): ExecutionContext => {
    Object.assign(request, { headers, method, tenantId: 'tenant-1' });
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    findFirst = jest.fn();
    const prisma = { period: { findFirst } } as unknown as PrismaService;
    guard = new PeriodGuard(prisma);
  });

  it('throws BadRequestException when the x-period-id header is missing', async () => {
    const context = createContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the period does not exist for the tenant', async () => {
    findFirst.mockResolvedValue(null);
    const context = createContext({ 'x-period-id': 'period-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException on a mutating request when the period is locked', async () => {
    findFirst.mockResolvedValue({ id: 'period-1', status: 'locked' });
    const context = createContext({ 'x-period-id': 'period-1' }, {}, 'POST');

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('allows a read request on a locked period', async () => {
    findFirst.mockResolvedValue({ id: 'period-1', status: 'locked' });
    const context = createContext({ 'x-period-id': 'period-1' }, {}, 'GET');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows the request and attaches periodId when the period is open', async () => {
    findFirst.mockResolvedValue({ id: 'period-1', status: 'open' });
    const request: Record<string, unknown> = {};
    const context = createContext({ 'x-period-id': 'period-1' }, request, 'POST');

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.periodId).toBe('period-1');
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'period-1', tenantId: 'tenant-1' } });
  });
});
