import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DimensionAccountRulesService } from './dimension-account-rules.service';
import { PrismaService } from '../../prisma/prisma.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function createDelegate(): DelegateMock {
  return { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
}

describe('DimensionAccountRulesService', () => {
  let service: DimensionAccountRulesService;
  let dimension: DelegateMock;
  let dimensionAccountRule: DelegateMock;

  beforeEach(async () => {
    dimension = createDelegate();
    dimensionAccountRule = createDelegate();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DimensionAccountRulesService,
        { provide: PrismaService, useValue: { dimension, dimensionAccountRule } },
      ],
    }).compile();

    service = module.get(DimensionAccountRulesService);
  });

  describe('create', () => {
    it('throws NotFoundException when the target dimension does not belong to the tenant/period', async () => {
      dimension.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'missing',
          applicability: 'MANDATORY',
          conditions: [{ sourceRange: '12100' }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when no conditions are provided', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.create('tenant-1', 'period-1', { dimensionId: 'd1', applicability: 'MANDATORY', conditions: [] }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a malformed source range', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          conditions: [{ sourceRange: '11999..11100' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('creates a single-condition, account-sourced rule scoped to the tenant and period', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionAccountRule.create.mockResolvedValue({ id: 'r1' });

      await service.create('tenant-1', 'period-1', {
        dimensionId: 'd1',
        applicability: 'MANDATORY',
        defaultMemberCode: 'CA_FA_ADD',
        conditions: [{ sourceRange: '11100..11999' }],
      });

      expect(dimensionAccountRule.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          periodId: 'period-1',
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          memberRange: undefined,
          defaultMemberCode: 'CA_FA_ADD',
          priority: 0,
          conditions: { create: [{ sourceDimensionId: undefined, sourceRange: '11100..11999' }] },
        },
        include: { conditions: true },
      });
    });

    it('throws BadRequestException when a condition sources off the rule\'s own target dimension', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          conditions: [{ sourceDimensionId: 'd1', sourceRange: 'CC100' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a condition\'s sourceDimensionId does not belong to the tenant/period', async () => {
      dimension.findFirst.mockResolvedValueOnce({ id: 'd1' }).mockResolvedValueOnce(null);

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          conditions: [{ sourceDimensionId: 'missing-dim', sourceRange: 'CC100' }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when two conditions key off the same source axis', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          conditions: [{ sourceRange: '11100' }, { sourceRange: '12100' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('creates a cross-dimension rule (e.g. Department -> Cost Center)', async () => {
      dimension.findFirst.mockResolvedValueOnce({ id: 'cost-center-dim' }).mockResolvedValueOnce({ id: 'department-dim' });
      dimensionAccountRule.create.mockResolvedValue({ id: 'r1' });

      await service.create('tenant-1', 'period-1', {
        dimensionId: 'cost-center-dim',
        applicability: 'MANDATORY',
        memberRange: 'CC100..CC120',
        defaultMemberCode: 'CC110',
        conditions: [{ sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' }],
      });

      expect(dimensionAccountRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dimensionId: 'cost-center-dim',
          memberRange: 'CC100..CC120',
          defaultMemberCode: 'CC110',
          conditions: { create: [{ sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' }] },
        }),
        include: { conditions: true },
      });
    });

    it('creates a genuine multi-key combination rule (Account AND Department -> Cost Center)', async () => {
      dimension.findFirst
        .mockResolvedValueOnce({ id: 'cost-center-dim' }) // target
        .mockResolvedValueOnce({ id: 'department-dim' }); // condition 2's source
      dimensionAccountRule.create.mockResolvedValue({ id: 'r1' });

      await service.create('tenant-1', 'period-1', {
        dimensionId: 'cost-center-dim',
        applicability: 'MANDATORY',
        conditions: [
          { sourceRange: '61100..61400' }, // Chart of Accounts leg
          { sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' },
        ],
      });

      expect(dimensionAccountRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conditions: {
            create: [
              { sourceDimensionId: undefined, sourceRange: '61100..61400' },
              { sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' },
            ],
          },
        }),
        include: { conditions: true },
      });
    });

    it('throws BadRequestException for a malformed member range', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          memberRange: 'CC120..CC100',
          conditions: [{ sourceRange: '12100' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when defaultMemberCode falls outside memberRange', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.create('tenant-1', 'period-1', {
          dimensionId: 'd1',
          applicability: 'MANDATORY',
          memberRange: 'CC100..CC120',
          defaultMemberCode: 'CC900',
          conditions: [{ sourceRange: '12100' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionAccountRule.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('replaces conditions when a new set is provided', async () => {
      dimensionAccountRule.findFirst.mockResolvedValue({ id: 'r1', dimensionId: 'd1', conditions: [] });
      dimension.findFirst.mockResolvedValue({ id: 'department-dim' });
      dimensionAccountRule.update.mockResolvedValue({ id: 'r1' });

      await service.update('tenant-1', 'period-1', 'r1', {
        conditions: [{ sourceDimensionId: 'department-dim', sourceRange: 'OPS' }],
      });

      expect(dimensionAccountRule.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({
          conditions: {
            deleteMany: {},
            create: [{ sourceDimensionId: 'department-dim', sourceRange: 'OPS' }],
          },
        }),
        include: { conditions: true },
      });
    });

    it('leaves existing conditions untouched when none are provided', async () => {
      dimensionAccountRule.findFirst.mockResolvedValue({ id: 'r1', dimensionId: 'd1', conditions: [] });
      dimensionAccountRule.update.mockResolvedValue({ id: 'r1' });

      await service.update('tenant-1', 'period-1', 'r1', { priority: 5 });

      expect(dimensionAccountRule.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { applicability: undefined, memberRange: undefined, defaultMemberCode: undefined, priority: 5 },
        include: { conditions: true },
      });
    });
  });

  describe('resolve', () => {
    it('throws NotFoundException when the dimension does not exist', async () => {
      dimension.findFirst.mockResolvedValue(null);

      await expect(service.resolve('tenant-1', 'period-1', 'missing', [{ code: '12100' }])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('falls back to MANDATORY for a system dimension when no rule matches', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', isSystem: true });
      dimensionAccountRule.findMany.mockResolvedValue([]);

      const result = await service.resolve('tenant-1', 'period-1', 'd1', [{ code: '99999' }]);

      expect(result).toEqual({
        dimensionId: 'd1',
        applicability: 'MANDATORY',
        memberRange: null,
        defaultMemberCode: null,
        matchedRuleId: null,
      });
    });

    it('falls back to OPTIONAL for a regular dimension when no rule matches', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', isSystem: false });
      dimensionAccountRule.findMany.mockResolvedValue([]);

      const result = await service.resolve('tenant-1', 'period-1', 'd1', [{ code: '99999' }]);

      expect(result.applicability).toBe('OPTIONAL');
    });

    it('matches a single-condition, account-sourced rule against the account code in context', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', isSystem: true });
      dimensionAccountRule.findMany.mockResolvedValue([
        {
          id: 'r1',
          applicability: 'MANDATORY',
          memberRange: null,
          defaultMemberCode: 'CA_FA_ADD',
          priority: 0,
          createdAt: new Date('2026-01-01'),
          conditions: [{ sourceDimensionId: null, sourceRange: '11100..11999' }],
        },
      ]);

      const result = await service.resolve('tenant-1', 'period-1', 'd1', [{ code: '11190' }]);

      expect(result.matchedRuleId).toBe('r1');
      expect(result.defaultMemberCode).toBe('CA_FA_ADD');
    });

    it('does not match a multi-condition rule when only some of its conditions are satisfied by the context', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'cost-center-dim', isSystem: false });
      dimensionAccountRule.findMany.mockResolvedValue([
        {
          id: 'combo-rule',
          applicability: 'MANDATORY',
          memberRange: null,
          defaultMemberCode: null,
          priority: 0,
          createdAt: new Date('2026-01-01'),
          conditions: [
            { sourceDimensionId: null, sourceRange: '61100..61400' },
            { sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' },
          ],
        },
      ]);

      // Only the account-code leg is provided — the Department leg is missing from context.
      const result = await service.resolve('tenant-1', 'period-1', 'cost-center-dim', [{ code: '61100' }]);

      expect(result.matchedRuleId).toBeNull();
      expect(result.applicability).toBe('OPTIONAL');
    });

    it('matches a multi-condition rule only when every condition is satisfied by the context', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'cost-center-dim', isSystem: false });
      dimensionAccountRule.findMany.mockResolvedValue([
        {
          id: 'combo-rule',
          applicability: 'MANDATORY',
          memberRange: 'CC100..CC120',
          defaultMemberCode: 'CC110',
          priority: 0,
          createdAt: new Date('2026-01-01'),
          conditions: [
            { sourceDimensionId: null, sourceRange: '61100..61400' },
            { sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' },
          ],
        },
      ]);

      const result = await service.resolve('tenant-1', 'period-1', 'cost-center-dim', [
        { code: '61200' },
        { sourceDimensionId: 'department-dim', code: 'FINANCE' },
      ]);

      expect(result).toEqual({
        dimensionId: 'cost-center-dim',
        applicability: 'MANDATORY',
        memberRange: 'CC100..CC120',
        defaultMemberCode: 'CC110',
        matchedRuleId: 'combo-rule',
      });
    });

    it('prefers a more specific multi-condition rule over a broader single-condition rule that also matches', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'cost-center-dim', isSystem: false });
      dimensionAccountRule.findMany.mockResolvedValue([
        {
          id: 'broad',
          applicability: 'OPTIONAL',
          memberRange: null,
          defaultMemberCode: null,
          priority: 0,
          createdAt: new Date('2026-01-01'),
          conditions: [{ sourceDimensionId: null, sourceRange: '61100..61400' }],
        },
        {
          id: 'combo',
          applicability: 'MANDATORY',
          memberRange: 'CC100..CC120',
          defaultMemberCode: 'CC110',
          priority: 0,
          createdAt: new Date('2026-01-02'),
          conditions: [
            { sourceDimensionId: null, sourceRange: '61100..61400' },
            { sourceDimensionId: 'department-dim', sourceRange: 'FINANCE' },
          ],
        },
      ]);

      const result = await service.resolve('tenant-1', 'period-1', 'cost-center-dim', [
        { code: '61200' },
        { sourceDimensionId: 'department-dim', code: 'FINANCE' },
      ]);

      expect(result.matchedRuleId).toBe('combo');
    });

    it('breaks a specificity tie using priority, then most-recently-created', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', isSystem: true });
      dimensionAccountRule.findMany.mockResolvedValue([
        {
          id: 'r-old',
          applicability: 'OPTIONAL',
          memberRange: null,
          defaultMemberCode: null,
          priority: 0,
          createdAt: new Date('2026-01-01'),
          conditions: [{ sourceDimensionId: null, sourceRange: '12100' }],
        },
        {
          id: 'r-new',
          applicability: 'PROHIBITED',
          memberRange: null,
          defaultMemberCode: null,
          priority: 0,
          createdAt: new Date('2026-02-01'),
          conditions: [{ sourceDimensionId: null, sourceRange: '12100' }],
        },
      ]);

      const result = await service.resolve('tenant-1', 'period-1', 'd1', [{ code: '12100' }]);

      expect(result.matchedRuleId).toBe('r-new');
      expect(result.applicability).toBe('PROHIBITED');
    });
  });

  describe('resolveAllDimensionsForAccount', () => {
    it('wraps the account code as a Chart-of-Accounts context entry for every dimension', async () => {
      dimension.findMany.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
      dimension.findFirst.mockResolvedValue({ id: 'd1', isSystem: false });
      dimensionAccountRule.findMany.mockResolvedValue([]);

      await service.resolveAllDimensionsForAccount('tenant-1', 'period-1', '12100');

      expect(dimension.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', periodId: 'period-1' } });
    });
  });
});
