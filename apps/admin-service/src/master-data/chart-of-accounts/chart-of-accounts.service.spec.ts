import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';

type ChartOfAccountDelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('ChartOfAccountsService', () => {
  let service: ChartOfAccountsService;
  let chartOfAccount: ChartOfAccountDelegateMock;
  let customFields: { assertValid: jest.Mock };

  beforeEach(async () => {
    chartOfAccount = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    customFields = { assertValid: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChartOfAccountsService,
        { provide: PrismaService, useValue: { chartOfAccount } },
        { provide: CustomFieldsService, useValue: customFields },
      ],
    }).compile();

    service = module.get(ChartOfAccountsService);
  });

  it('findAll scopes the query by tenant and period', async () => {
    chartOfAccount.findMany.mockResolvedValue([{ id: 'a1' }]);

    const result = await service.findAll('tenant-1', 'period-1');

    expect(chartOfAccount.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', periodId: 'period-1' },
      orderBy: { accountCode: 'asc' },
    });
    expect(result).toEqual([{ id: 'a1' }]);
  });

  it('findOne throws NotFoundException when missing', async () => {
    chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'period-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('create succeeds without a parent code', async () => {
    chartOfAccount.create.mockResolvedValue({ id: 'a1' });

    await service.create('tenant-1', 'period-1', {
      accountCode: '1000',
      accountName: 'Cash',
      accountType: 'ASSET',
      accountNature: 'DEBIT',
    });

    expect(chartOfAccount.findUnique).not.toHaveBeenCalled();
    expect(chartOfAccount.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        periodId: 'period-1',
        accountCode: '1000',
        accountName: 'Cash',
        accountType: 'ASSET',
        accountNature: 'DEBIT',
        parentCode: undefined,
        rollupWeight: 1,
      },
    });
  });

  it('create throws BadRequestException when the parent account does not exist', async () => {
    chartOfAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.create('tenant-1', 'period-1', {
        accountCode: '1001',
        accountName: 'Petty Cash',
        accountType: 'ASSET',
        accountNature: 'DEBIT',
        parentCode: '1000',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(chartOfAccount.create).not.toHaveBeenCalled();
  });

  it('create succeeds when the parent account exists', async () => {
    chartOfAccount.findUnique.mockResolvedValue({ accountCode: '1000' });
    chartOfAccount.create.mockResolvedValue({ id: 'a2' });

    await service.create('tenant-1', 'period-1', {
      accountCode: '1001',
      accountName: 'Petty Cash',
      accountType: 'ASSET',
      accountNature: 'DEBIT',
      parentCode: '1000',
    });

    expect(chartOfAccount.findUnique).toHaveBeenCalledWith({
      where: { tenantId_periodId_accountCode: { tenantId: 'tenant-1', periodId: 'period-1', accountCode: '1000' } },
    });
    expect(chartOfAccount.create).toHaveBeenCalled();
  });

  it('update throws NotFoundException when the account does not exist', async () => {
    chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.update('tenant-1', 'period-1', 'missing', { accountName: 'New name' }),
    ).rejects.toThrow(NotFoundException);
    expect(chartOfAccount.update).not.toHaveBeenCalled();
  });

  it('remove deletes the account after verifying it exists', async () => {
    chartOfAccount.findFirst.mockResolvedValue({ id: 'a1' });

    await service.remove('tenant-1', 'period-1', 'a1');

    expect(chartOfAccount.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
