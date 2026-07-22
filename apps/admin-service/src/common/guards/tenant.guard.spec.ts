import { ExecutionContext, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let findUnique: jest.Mock;

  const createContext = (headers: Record<string, string>, request: Record<string, unknown> = {}): ExecutionContext => {
    Object.assign(request, { headers });
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    findUnique = jest.fn();
    const prisma = { tenant: { findUnique } } as unknown as PrismaService;
    guard = new TenantGuard(prisma);
  });

  it('throws BadRequestException when the x-tenant-id header is missing', async () => {
    const context = createContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the tenant does not exist', async () => {
    findUnique.mockResolvedValue(null);
    const context = createContext({ 'x-tenant-id': 'tenant-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the tenant is not active', async () => {
    findUnique.mockResolvedValue({ id: 'tenant-1', status: 'suspended' });
    const context = createContext({ 'x-tenant-id': 'tenant-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('allows the request and attaches tenantId when the tenant is active', async () => {
    findUnique.mockResolvedValue({ id: 'tenant-1', status: 'active' });
    const request: Record<string, unknown> = {};
    const context = createContext({ 'x-tenant-id': 'tenant-1' }, request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.tenantId).toBe('tenant-1');
  });
});
