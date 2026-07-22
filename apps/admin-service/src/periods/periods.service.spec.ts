import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { PrismaService } from '../prisma/prisma.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUniqueOrThrow?: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  upsert?: jest.Mock;
  delete: jest.Mock;
  count?: jest.Mock;
};

function createDelegate(): DelegateMock {
  return {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };
}

describe('PeriodsService', () => {
  let service: PeriodsService;
  let fiscalYear: DelegateMock;
  let period: DelegateMock;
  let entity: DelegateMock;
  let chartOfAccount: DelegateMock;
  let dimension: DelegateMock;
  let dimensionMember: DelegateMock;
  let consolidationGroup: DelegateMock;
  let groupEntity: DelegateMock;
  let ownershipPeriod: DelegateMock;
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    fiscalYear = createDelegate();
    period = createDelegate();
    entity = createDelegate();
    chartOfAccount = createDelegate();
    dimension = createDelegate();
    dimensionMember = createDelegate();
    consolidationGroup = createDelegate();
    groupEntity = createDelegate();
    ownershipPeriod = createDelegate();

    prisma = {
      fiscalYear,
      period,
      entity,
      chartOfAccount,
      dimension,
      dimensionMember,
      consolidationGroup,
      groupEntity,
      ownershipPeriod,
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PeriodsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PeriodsService);
  });

  describe('createFiscalYear', () => {
    it('generates 12 regular periods plus n adjustment periods with sequential codes', async () => {
      fiscalYear.create.mockResolvedValue({ id: 'fy1' });
      period.findFirst.mockResolvedValue(null); // no prior period
      let counter = 0;
      period.create.mockImplementation(() => Promise.resolve({ id: `p${++counter}` }));
      fiscalYear.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'fy1', periods: [] });

      await service.createFiscalYear('tenant-1', { startYear: 2026, startMonth: 1, adjustmentPeriods: 2 });

      expect(period.create).toHaveBeenCalledTimes(14);

      const firstCall = period.create.mock.calls[0][0];
      expect(firstCall.data).toMatchObject({
        tenantId: 'tenant-1',
        fiscalYearId: 'fy1',
        period: '2026-001',
        periodNumber: '001',
        isAdjustment: false,
        name: 'Jan 2026',
      });

      const lastRegularCall = period.create.mock.calls[11][0];
      expect(lastRegularCall.data).toMatchObject({ period: '2026-012', periodNumber: '012', name: 'Dec 2026' });

      const firstAdjustmentCall = period.create.mock.calls[12][0];
      expect(firstAdjustmentCall.data).toMatchObject({
        period: '2026-013',
        periodNumber: '013',
        isAdjustment: true,
        name: 'Adjustment 1',
      });
      // adjustment period shares start/end with the last regular period's end date
      expect(firstAdjustmentCall.data.startDate).toEqual(lastRegularCall.data.endDate);
      expect(firstAdjustmentCall.data.endDate).toEqual(lastRegularCall.data.endDate);
    });

    it('chains openingBalanceSourcePeriodId from one generated period to the next', async () => {
      fiscalYear.create.mockResolvedValue({ id: 'fy1' });
      period.findFirst.mockResolvedValue({ id: 'prior-period' }); // most recent period before the year
      let counter = 0;
      period.create.mockImplementation(() => Promise.resolve({ id: `p${++counter}` }));
      fiscalYear.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'fy1', periods: [] });

      await service.createFiscalYear('tenant-1', { startYear: 2026, startMonth: 1, regularPeriods: 3 });

      expect(period.create.mock.calls[0][0].data.openingBalanceSourcePeriodId).toBe('prior-period');
      expect(period.create.mock.calls[1][0].data.openingBalanceSourcePeriodId).toBe('p1');
      expect(period.create.mock.calls[2][0].data.openingBalanceSourcePeriodId).toBe('p2');
    });
  });

  describe('createPeriod', () => {
    it('defaults the period code and number when not provided', async () => {
      period.count = jest.fn().mockResolvedValue(2);
      period.findFirst.mockResolvedValue(null);
      period.create.mockResolvedValue({ id: 'p1' });

      await service.createPeriod('tenant-1', {
        name: 'Custom Period',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      });

      expect(period.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Custom Period',
          period: '2026-003',
          periodNumber: '003',
          isAdjustment: false,
        }),
      });
    });

    it('honors a manually supplied alphanumeric period code', async () => {
      period.findFirst.mockResolvedValue(null);
      period.create.mockResolvedValue({ id: 'p1' });

      await service.createPeriod('tenant-1', {
        name: 'Special Adjustment',
        period: '2026-ADJ-A',
        periodNumber: 'ADJ-A',
        isAdjustment: true,
        startDate: '2026-12-31',
        endDate: '2026-12-31',
      });

      expect(period.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ period: '2026-ADJ-A', periodNumber: 'ADJ-A', isAdjustment: true }),
      });
    });
  });

  describe('upsertPeriod / bulkCreatePeriods', () => {
    it('upserts by the tenant+period code so re-importing the same code updates in place', async () => {
      period.findFirst.mockResolvedValue(null);
      period.upsert!.mockResolvedValue({ id: 'p1' });

      await service.upsertPeriod('tenant-1', {
        name: 'June 2026',
        period: '2026-006',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      });

      expect(period.upsert).toHaveBeenCalledWith({
        where: { tenantId_period: { tenantId: 'tenant-1', period: '2026-006' } },
        create: expect.objectContaining({ tenantId: 'tenant-1', name: 'June 2026', period: '2026-006' }),
        update: expect.objectContaining({ name: 'June 2026' }),
      });
    });

    it('bulkCreatePeriods reports a per-row error for invalid rows without throwing', async () => {
      const result = await service.bulkCreatePeriods('tenant-1', [{ name: 'Missing dates' }]);

      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(period.upsert).not.toHaveBeenCalled();
    });
  });

  describe('copyMasterData', () => {
    it('throws BadRequestException when source and target periods are the same', async () => {
      period.findFirst.mockResolvedValue({ id: 'p1' });

      await expect(service.copyMasterData('tenant-1', 'p1', { sourcePeriodId: 'p1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('clones entities, accounts, dimensions, and remaps ids in ownership records', async () => {
      period.findFirst.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id }),
      );

      entity.findMany.mockResolvedValue([
        { id: 'src-e1', code: 'E1', name: 'Entity 1', country: 'USA', currency: 'USD', status: 'active' },
      ]);
      entity.create.mockResolvedValue({ id: 'new-e1' });

      chartOfAccount.findMany.mockResolvedValue([
        {
          accountCode: '1000',
          accountName: 'Cash',
          accountType: 'ASSET',
          accountNature: 'DEBIT',
          parentCode: null,
          rollupWeight: 1,
          status: 'active',
        },
      ]);

      dimension.findMany.mockResolvedValue([
        {
          id: 'src-dim1',
          name: 'Cost Center',
          type: 'COST_CENTER',
          status: 'active',
          members: [
            { id: 'm1', code: 'CC1', name: 'Root', parentCode: null, weight: 1, status: 'active' },
            { id: 'm2', code: 'CC2', name: 'Child', parentCode: 'CC1', weight: 1, status: 'active' },
          ],
        },
      ]);
      dimension.create.mockResolvedValue({ id: 'new-dim1' });
      dimensionMember.create
        .mockResolvedValueOnce({ id: 'new-m1' })
        .mockResolvedValueOnce({ id: 'new-m2' });

      consolidationGroup.findMany.mockResolvedValue([
        {
          id: 'src-g1',
          code: 'GRP',
          name: 'Global Group',
          reportingCurrency: 'USD',
          parentEntityId: 'src-e1',
          status: 'active',
          members: [
            { entityId: 'src-e1', consolidationMethod: 'FULL', effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
          ],
          ownershipPeriods: [
            {
              parentEntityId: 'src-e1',
              subsidiaryEntityId: 'src-e1',
              directPercentage: 100,
              effectivePercentage: 100,
              nciPercentage: 0,
              effectiveFromPeriod: '2026-01',
              effectiveToPeriod: null,
              acquisitionCost: null,
              acquisitionDate: null,
            },
          ],
        },
      ]);
      consolidationGroup.create.mockResolvedValue({ id: 'new-g1' });

      period.update.mockResolvedValue({});
      period.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'target-period' });

      await service.copyMasterData('tenant-1', 'target-period', { sourcePeriodId: 'source-period' });

      expect(entity.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          periodId: 'target-period',
          code: 'E1',
          name: 'Entity 1',
          country: 'USA',
          currency: 'USD',
          status: 'active',
        },
      });

      // dimension members copied in source order, parentCode carried over as-is (code-based, no remapping)
      expect(dimensionMember.create).toHaveBeenNthCalledWith(1, {
        data: { dimensionId: 'new-dim1', code: 'CC1', name: 'Root', parentCode: null, weight: 1, status: 'active' },
      });
      expect(dimensionMember.create).toHaveBeenNthCalledWith(2, {
        data: { dimensionId: 'new-dim1', code: 'CC2', name: 'Child', parentCode: 'CC1', weight: 1, status: 'active' },
      });

      // group parentEntityId and member/ownership entity ids remapped to the newly created entities
      expect(consolidationGroup.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ periodId: 'target-period', parentEntityId: 'new-e1' }),
      });
      expect(groupEntity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'new-g1', entityId: 'new-e1' }),
      });
      expect(ownershipPeriod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ parentEntityId: 'new-e1', subsidiaryEntityId: 'new-e1', groupId: 'new-g1' }),
      });

      expect(period.update).toHaveBeenCalledWith({
        where: { id: 'target-period' },
        data: { copiedFromPeriodId: 'source-period' },
      });
    });
  });
});
