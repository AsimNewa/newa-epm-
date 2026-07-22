import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DimensionsService } from './dimensions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
};

describe('DimensionsService', () => {
  let service: DimensionsService;
  let dimension: DelegateMock;
  let dimensionMember: DelegateMock;
  let dimensionAccountRule: DelegateMock;
  let customFields: { assertValid: jest.Mock };

  beforeEach(async () => {
    dimension = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    };
    dimensionMember = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    };
    dimensionAccountRule = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    };
    customFields = { assertValid: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DimensionsService,
        { provide: PrismaService, useValue: { dimension, dimensionMember, dimensionAccountRule } },
        { provide: CustomFieldsService, useValue: customFields },
      ],
    }).compile();

    service = module.get(DimensionsService);
  });

  describe('dimensions', () => {
    it('findAll scopes the query by tenant and period and includes members', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'flow-dim-existing' }); // FlowCode already provisioned
      dimension.findMany.mockResolvedValue([{ id: 'd1', members: [] }]);

      const result = await service.findAll('tenant-1', 'period-1');

      expect(dimension.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', periodId: 'period-1' },
        include: { members: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([{ id: 'd1', members: [] }]);
    });

    it('findAll does not recreate the FlowCode dimension when it already exists', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'flow-dim-existing' });
      dimension.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', 'period-1');

      expect(dimension.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', periodId: 'period-1', name: 'FlowCode' },
      });
      expect(dimension.create).not.toHaveBeenCalled();
      expect(dimensionMember.create).not.toHaveBeenCalled();
    });

    it('findAll provisions the FlowCode system dimension with its default members when missing', async () => {
      dimension.findFirst.mockResolvedValue(null);
      dimension.create.mockResolvedValue({ id: 'flow-dim-new' });
      dimension.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', 'period-1');

      expect(dimension.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', periodId: 'period-1', name: 'FlowCode', type: 'FLOW_CODE', isSystem: true },
      });
      // Base members are created before any child that references them as parentCode.
      expect(dimensionMember.create).toHaveBeenNthCalledWith(1, {
        data: { dimensionId: 'flow-dim-new', code: '0CA', name: 'Cash Changes', parentCode: undefined, weight: 1 },
      });
      expect(dimensionMember.create).toHaveBeenNthCalledWith(2, {
        data: { dimensionId: 'flow-dim-new', code: '0NC', name: 'Non-Cash Flow', parentCode: undefined, weight: 1 },
      });
      expect(dimensionMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'NC_DEPR', parentCode: '0NC', weight: -1 }) }),
      );
      // Account applicability rules are seeded alongside the members — header accounts Optional,
      // e.g. 12100 (Cash) Mandatory defaulting to the top-level Cash bucket.
      expect(dimensionAccountRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          periodId: 'period-1',
          dimensionId: 'flow-dim-new',
          applicability: 'OPTIONAL',
          conditions: { create: [{ sourceRange: expect.stringContaining('10000') }] },
        }),
      });
      expect(dimensionAccountRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicability: 'MANDATORY',
          defaultMemberCode: '0CA',
          conditions: { create: [{ sourceRange: '12100' }] },
        }),
      });
    });

    it('update throws BadRequestException when renaming a system dimension', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', name: 'FlowCode', isSystem: true });

      await expect(
        service.update('tenant-1', 'period-1', 'd1', { name: 'Renamed' }),
      ).rejects.toThrow(BadRequestException);
      expect(dimension.update).not.toHaveBeenCalled();
    });

    it('update allows non-rename changes (e.g. status) to a system dimension', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', name: 'FlowCode', isSystem: true });
      dimension.update.mockResolvedValue({ id: 'd1' });

      await service.update('tenant-1', 'period-1', 'd1', { status: 'inactive' });

      expect(dimension.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { status: 'inactive' } });
    });

    it('remove throws BadRequestException when deleting a system dimension', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1', name: 'FlowCode', isSystem: true });

      await expect(service.remove('tenant-1', 'period-1', 'd1')).rejects.toThrow(BadRequestException);
      expect(dimension.delete).not.toHaveBeenCalled();
    });

    it('findOne throws NotFoundException when missing', async () => {
      dimension.findFirst.mockResolvedValue(null);

      await expect(service.findOne('tenant-1', 'period-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('create scopes the dimension to the tenant and period', async () => {
      dimension.create.mockResolvedValue({ id: 'd1' });

      await service.create('tenant-1', 'period-1', { name: 'Cost Center', type: 'COST_CENTER' });

      expect(dimension.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', periodId: 'period-1', name: 'Cost Center', type: 'COST_CENTER' },
      });
    });

    it('remove deletes the dimension after verifying it exists', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await service.remove('tenant-1', 'period-1', 'd1');

      expect(dimension.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });
  });

  describe('members', () => {
    it('findMember throws NotFoundException when the parent dimension does not exist', async () => {
      dimension.findFirst.mockResolvedValue(null);

      await expect(service.findMember('tenant-1', 'period-1', 'missing-dim', 'm1')).rejects.toThrow(
        NotFoundException,
      );
      expect(dimensionMember.findFirst).not.toHaveBeenCalled();
    });

    it('findMember throws NotFoundException when the member does not exist', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionMember.findFirst.mockResolvedValue(null);

      await expect(service.findMember('tenant-1', 'period-1', 'd1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('createMember verifies the dimension belongs to the tenant and period before creating', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionMember.create.mockResolvedValue({ id: 'm1' });

      await service.createMember('tenant-1', 'period-1', 'd1', { code: 'CC100', name: 'Sales' });

      expect(dimension.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', tenantId: 'tenant-1', periodId: 'period-1' },
        include: { members: true },
      });
      expect(dimensionMember.create).toHaveBeenCalledWith({
        data: { dimensionId: 'd1', code: 'CC100', name: 'Sales', parentCode: undefined, weight: 1 },
      });
    });

    it('createMember throws NotFoundException when the dimension does not belong to the tenant', async () => {
      dimension.findFirst.mockResolvedValue(null);

      await expect(
        service.createMember('tenant-1', 'period-1', 'missing-dim', { code: 'CC100', name: 'Sales' }),
      ).rejects.toThrow(NotFoundException);
      expect(dimensionMember.create).not.toHaveBeenCalled();
    });

    it('createMember throws BadRequestException when the parent member does not exist in the dimension', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionMember.findFirst.mockResolvedValue(null);

      await expect(
        service.createMember('tenant-1', 'period-1', 'd1', {
          code: 'CC101',
          name: 'Sales EMEA',
          parentCode: 'MISSING',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionMember.create).not.toHaveBeenCalled();
    });

    it('createMember creates with a valid parentCode and custom weight', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionMember.findFirst.mockResolvedValue({ id: 'parent-1', code: 'CC100' });
      dimensionMember.create.mockResolvedValue({ id: 'm2' });

      await service.createMember('tenant-1', 'period-1', 'd1', {
        code: 'CC101',
        name: 'Sales EMEA',
        parentCode: 'CC100',
        weight: -1,
      });

      expect(dimensionMember.findFirst).toHaveBeenCalledWith({ where: { dimensionId: 'd1', code: 'CC100' } });
      expect(dimensionMember.create).toHaveBeenCalledWith({
        data: { dimensionId: 'd1', code: 'CC101', name: 'Sales EMEA', parentCode: 'CC100', weight: -1 },
      });
    });

    it('createMember throws BadRequestException when parentCode equals its own code', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        service.createMember('tenant-1', 'period-1', 'd1', { code: 'CC100', name: 'Sales', parentCode: 'CC100' }),
      ).rejects.toThrow(BadRequestException);
      expect(dimensionMember.findFirst).not.toHaveBeenCalled();
      expect(dimensionMember.create).not.toHaveBeenCalled();
    });

    it('updateMember throws BadRequestException when parentCode equals its own code', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionMember.findFirst.mockResolvedValue({ id: 'm1', code: 'CC100' });

      await expect(
        service.updateMember('tenant-1', 'period-1', 'd1', 'm1', { parentCode: 'CC100' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('removeMember deletes after verifying the member exists', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'd1' });
      dimensionMember.findFirst.mockResolvedValue({ id: 'm1' });

      await service.removeMember('tenant-1', 'period-1', 'd1', 'm1');

      expect(dimensionMember.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });

  describe('bulkCreateMembersAcrossDimensions', () => {
    it('resolves each row to its own dimension by name and upserts the member there', async () => {
      dimension.findFirst.mockResolvedValueOnce({ id: 'dim-cc' }).mockResolvedValueOnce({ id: 'dim-dept' });
      dimensionMember.findFirst.mockResolvedValue(null); // no parentCode on either row
      dimensionMember.upsert.mockResolvedValue({ id: 'm1' });

      const result = await service.bulkCreateMembersAcrossDimensions('tenant-1', 'period-1', [
        { dimension: 'Cost Center', code: 'CC100', name: 'Sales' },
        { dimension: 'Department', code: 'FIN', name: 'Finance' },
      ]);

      expect(dimension.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          tenantId: 'tenant-1',
          periodId: 'period-1',
          OR: [
            { name: { equals: 'Cost Center', mode: 'insensitive' } },
            { type: { equals: 'Cost Center', mode: 'insensitive' } },
          ],
        },
      });
      expect(dimensionMember.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: { dimensionId_code: { dimensionId: 'dim-cc', code: 'CC100' } },
      }));
      expect(dimensionMember.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: { dimensionId_code: { dimensionId: 'dim-dept', code: 'FIN' } },
      }));
      expect(result).toEqual({ created: 2, errors: [] });
    });

    it('resolves a row by dimension type when it does not match a dimension name', async () => {
      dimension.findFirst.mockResolvedValue({ id: 'dim-cc' });
      dimensionMember.upsert.mockResolvedValue({ id: 'm1' });

      const result = await service.bulkCreateMembersAcrossDimensions('tenant-1', 'period-1', [
        { dimension: 'COST_CENTER', code: 'CC100', name: 'Sales' },
      ]);

      expect(result.created).toBe(1);
      expect(dimensionMember.upsert).toHaveBeenCalled();
    });

    it('records a per-row error when the dimension column does not match any dimension', async () => {
      dimension.findFirst.mockResolvedValue(null);

      const result = await service.bulkCreateMembersAcrossDimensions('tenant-1', 'period-1', [
        { dimension: 'Nonexistent', code: 'X1', name: 'X' },
      ]);

      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toMatch(/Nonexistent/);
      expect(dimensionMember.upsert).not.toHaveBeenCalled();
    });
  });
});
