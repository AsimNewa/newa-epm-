import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OwnershipService } from './ownership.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
};

function makeDelegateMock(): DelegateMock {
  return {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
}

describe('OwnershipService', () => {
  let service: OwnershipService;
  let consolidationGroup: DelegateMock;
  let groupEntity: DelegateMock;
  let ownershipPeriod: DelegateMock;
  let period: DelegateMock;
  let entity: DelegateMock;
  let customFields: { assertValid: jest.Mock };

  beforeEach(async () => {
    consolidationGroup = makeDelegateMock();
    groupEntity = makeDelegateMock();
    ownershipPeriod = makeDelegateMock();
    period = makeDelegateMock();
    entity = makeDelegateMock();

    customFields = { assertValid: jest.fn().mockResolvedValue(undefined) };

    // The mocked $transaction callback receives the same delegate mocks as "tx" — good enough
    // for unit tests since we're not exercising real Prisma transaction semantics here.
    const prisma: Record<string, unknown> = {
      consolidationGroup,
      groupEntity,
      ownershipPeriod,
      period,
      entity,
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomFieldsService, useValue: customFields },
      ],
    }).compile();

    service = module.get(OwnershipService);
  });

  describe('groups', () => {
    it('findGroup throws NotFoundException when missing', async () => {
      consolidationGroup.findFirst.mockResolvedValue(null);

      await expect(service.findGroup('tenant-1', 'period-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('createGroup scopes the group to the tenant and period', async () => {
      consolidationGroup.create.mockResolvedValue({ id: 'g1' });

      await service.createGroup('tenant-1', 'period-1', {
        code: 'GRP',
        name: 'Global Group',
        reportingCurrency: 'USD',
      });

      expect(consolidationGroup.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          periodId: 'period-1',
          code: 'GRP',
          name: 'Global Group',
          reportingCurrency: 'USD',
          parentEntityId: undefined,
        },
      });
    });
  });

  describe('members', () => {
    it('createMember verifies the group belongs to the tenant and period', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      groupEntity.create.mockResolvedValue({ id: 'm1' });

      await service.createMember('tenant-1', 'period-1', 'g1', {
        entityId: 'e1',
        consolidationMethod: 'FULL',
        effectiveFrom: '2026-01-01',
      });

      expect(groupEntity.create).toHaveBeenCalledWith({
        data: {
          groupId: 'g1',
          entityId: 'e1',
          consolidationMethod: 'FULL',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: undefined,
        },
        include: { entity: true },
      });
    });

    it('createMember throws NotFoundException when the group does not exist', async () => {
      consolidationGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.createMember('tenant-1', 'period-1', 'missing-group', {
          entityId: 'e1',
          consolidationMethod: 'FULL',
          effectiveFrom: '2026-01-01',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(groupEntity.create).not.toHaveBeenCalled();
    });
  });

  describe('ownership periods', () => {
    it('createOwnershipPeriod throws BadRequestException when effectiveFromPeriodId does not exist', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      period.findFirst.mockResolvedValue(null);

      await expect(
        service.createOwnershipPeriod('tenant-1', 'period-1', 'g1', {
          parentEntityId: 'parent-e',
          subsidiaryEntityId: 'sub-e',
          directPercentage: 80,
          effectiveFromPeriodId: 'missing-period',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(ownershipPeriod.create).not.toHaveBeenCalled();
    });

    it('createOwnershipPeriod defaults effectivePercentage and nciPercentage from directPercentage', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      period.findFirst.mockResolvedValue({ id: 'period-jan', startDate: new Date('2026-01-01') });
      ownershipPeriod.create.mockResolvedValue({ id: 'op1' });

      await service.createOwnershipPeriod('tenant-1', 'period-1', 'g1', {
        parentEntityId: 'parent-e',
        subsidiaryEntityId: 'sub-e',
        directPercentage: 80,
        effectiveFromPeriodId: 'period-jan',
      });

      expect(ownershipPeriod.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          groupId: 'g1',
          parentEntityId: 'parent-e',
          subsidiaryEntityId: 'sub-e',
          directPercentage: 80,
          effectivePercentage: 80,
          nciPercentage: 20,
          effectiveFromPeriodId: 'period-jan',
          effectiveToPeriodId: undefined,
          acquisitionCost: undefined,
          acquisitionDate: undefined,
        },
        include: { parentEntity: true, subsidiaryEntity: true, effectiveFromPeriod: true, effectiveToPeriod: true },
      });
    });

    it('createOwnershipPeriod honors explicit effective/nci percentages', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      period.findFirst.mockResolvedValue({ id: 'period-jan', startDate: new Date('2026-01-01') });
      ownershipPeriod.create.mockResolvedValue({ id: 'op1' });

      await service.createOwnershipPeriod('tenant-1', 'period-1', 'g1', {
        parentEntityId: 'parent-e',
        subsidiaryEntityId: 'sub-e',
        directPercentage: 80,
        effectivePercentage: 72,
        nciPercentage: 28,
        effectiveFromPeriodId: 'period-jan',
      });

      expect(ownershipPeriod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ effectivePercentage: 72, nciPercentage: 28 }),
        }),
      );
    });

    it('createOwnershipPeriod throws BadRequestException when effectiveToPeriodId is before effectiveFromPeriodId', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      period.findFirst
        .mockResolvedValueOnce({ id: 'period-jan', startDate: new Date('2026-01-01') }) // resolvePeriod for from
        .mockResolvedValueOnce({ id: 'period-jan', startDate: new Date('2026-01-01') }) // assertChronologicalOrder from
        .mockResolvedValueOnce({ id: 'period-dec-prior', startDate: new Date('2025-12-01') }); // assertChronologicalOrder to

      await expect(
        service.createOwnershipPeriod('tenant-1', 'period-1', 'g1', {
          parentEntityId: 'parent-e',
          subsidiaryEntityId: 'sub-e',
          directPercentage: 80,
          effectiveFromPeriodId: 'period-jan',
          effectiveToPeriodId: 'period-dec-prior',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(ownershipPeriod.create).not.toHaveBeenCalled();
    });

    it('removeOwnershipPeriod deletes after verifying it exists', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      ownershipPeriod.findFirst.mockResolvedValue({ id: 'op1' });

      await service.removeOwnershipPeriod('tenant-1', 'period-1', 'g1', 'op1');

      expect(ownershipPeriod.delete).toHaveBeenCalledWith({ where: { id: 'op1' } });
    });
  });

  describe('ownership structure', () => {
    const fromPeriod = { id: 'period-jan', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') };

    it('createOwnershipStructureEntry writes both an OwnershipPeriod and a GroupEntity row', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      period.findFirst.mockResolvedValue(fromPeriod);
      ownershipPeriod.upsert.mockResolvedValue({ id: 'op1' });
      ownershipPeriod.findFirst.mockResolvedValue({
        id: 'op1',
        subsidiaryEntityId: 'sub-e',
        effectiveFromPeriod: fromPeriod,
      });
      groupEntity.findUnique.mockResolvedValue({ consolidationMethod: 'FULL' });

      await service.createOwnershipStructureEntry('tenant-1', 'period-1', 'g1', {
        parentEntityId: 'parent-e',
        subsidiaryEntityId: 'sub-e',
        consolidationMethod: 'FULL',
        directPercentage: 80,
        effectiveFromPeriodId: 'period-jan',
      });

      expect(ownershipPeriod.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: 'tenant-1',
            groupId: 'g1',
            parentEntityId: 'parent-e',
            subsidiaryEntityId: 'sub-e',
            effectiveFromPeriodId: 'period-jan',
            directPercentage: 80,
            effectivePercentage: 80,
            nciPercentage: 20,
          }),
        }),
      );
      expect(groupEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            groupId_entityId_effectiveFrom: { groupId: 'g1', entityId: 'sub-e', effectiveFrom: fromPeriod.startDate },
          },
          create: expect.objectContaining({ consolidationMethod: 'FULL', effectiveFrom: fromPeriod.startDate }),
          update: expect.objectContaining({ consolidationMethod: 'FULL' }),
        }),
      );
    });

    it('updateOwnershipStructureEntry never touches identity fields', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      ownershipPeriod.findFirst.mockResolvedValue({
        id: 'op1',
        subsidiaryEntityId: 'sub-e',
        effectiveFromPeriodId: 'period-jan',
        effectiveFromPeriod: fromPeriod,
      });
      groupEntity.findUnique.mockResolvedValue({ consolidationMethod: 'EQUITY' });

      await service.updateOwnershipStructureEntry('tenant-1', 'period-1', 'g1', 'op1', {
        directPercentage: 60,
        consolidationMethod: 'EQUITY',
      });

      const updateCall = ownershipPeriod.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'op1' });
      expect(updateCall.data).not.toHaveProperty('parentEntityId');
      expect(updateCall.data).not.toHaveProperty('subsidiaryEntityId');
      expect(updateCall.data).not.toHaveProperty('effectiveFromPeriodId');
      expect(updateCall.data.directPercentage).toBe(60);

      expect(groupEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            groupId_entityId_effectiveFrom: { groupId: 'g1', entityId: 'sub-e', effectiveFrom: fromPeriod.startDate },
          },
          update: expect.objectContaining({ consolidationMethod: 'EQUITY' }),
        }),
      );
    });

    it('removeOwnershipStructureEntry deletes the GroupEntity row when no other entry references it', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      ownershipPeriod.findFirst
        .mockResolvedValueOnce({ id: 'op1', subsidiaryEntityId: 'sub-e', effectiveFromPeriod: fromPeriod }) // findOwnershipPeriod
        .mockResolvedValueOnce(null); // stillReferenced check

      await service.removeOwnershipStructureEntry('tenant-1', 'period-1', 'g1', 'op1');

      expect(ownershipPeriod.delete).toHaveBeenCalledWith({ where: { id: 'op1' } });
      expect(groupEntity.deleteMany).toHaveBeenCalledWith({
        where: { groupId: 'g1', entityId: 'sub-e', effectiveFrom: fromPeriod.startDate },
      });
    });

    it('removeOwnershipStructureEntry leaves the GroupEntity row when another entry still references it', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      ownershipPeriod.findFirst
        .mockResolvedValueOnce({ id: 'op1', subsidiaryEntityId: 'sub-e', effectiveFromPeriod: fromPeriod }) // findOwnershipPeriod
        .mockResolvedValueOnce({ id: 'op2' }); // stillReferenced check finds another row

      await service.removeOwnershipStructureEntry('tenant-1', 'period-1', 'g1', 'op1');

      expect(ownershipPeriod.delete).toHaveBeenCalledWith({ where: { id: 'op1' } });
      expect(groupEntity.deleteMany).not.toHaveBeenCalled();
    });

    it('bulkImportOwnershipStructure resolves entity/period codes and reports a row error when a code is unknown', async () => {
      consolidationGroup.findFirst.mockResolvedValue({ id: 'g1' });
      entity.findUnique
        .mockResolvedValueOnce({ id: 'sub-e', code: 'SUB' }) // valid row: subsidiary
        .mockResolvedValueOnce({ id: 'parent-e', code: 'PARENT' }) // valid row: parent
        .mockResolvedValueOnce(null); // invalid row: unknown subsidiary code
      period.findUnique.mockResolvedValue(fromPeriod);
      period.findFirst.mockResolvedValue(fromPeriod);
      ownershipPeriod.upsert.mockResolvedValue({ id: 'op1' });
      ownershipPeriod.findFirst.mockResolvedValue({
        id: 'op1',
        subsidiaryEntityId: 'sub-e',
        effectiveFromPeriod: fromPeriod,
      });
      groupEntity.findUnique.mockResolvedValue({ consolidationMethod: 'FULL' });

      const result = await service.bulkImportOwnershipStructure('tenant-1', 'period-1', 'g1', [
        {
          subsidiaryEntityCode: 'SUB',
          parentEntityCode: 'PARENT',
          consolidationMethod: 'FULL',
          directPercentage: 80,
          effectiveFromPeriod: 'period-jan',
        },
        {
          subsidiaryEntityCode: 'UNKNOWN',
          parentEntityCode: 'PARENT',
          consolidationMethod: 'FULL',
          directPercentage: 80,
          effectiveFromPeriod: 'period-jan',
        },
      ]);

      expect(result.created).toBe(1);
      expect(result.errors).toEqual([{ row: 2, message: 'Entity UNKNOWN does not exist' }]);
    });
  });
});
