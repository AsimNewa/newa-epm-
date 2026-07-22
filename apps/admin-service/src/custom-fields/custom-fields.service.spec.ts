import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { PrismaService } from '../prisma/prisma.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
};

describe('CustomFieldsService', () => {
  let service: CustomFieldsService;
  let customFieldDefinition: DelegateMock;

  beforeEach(async () => {
    customFieldDefinition = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomFieldsService, { provide: PrismaService, useValue: { customFieldDefinition } }],
    }).compile();

    service = module.get(CustomFieldsService);
  });

  it('findOne throws NotFoundException when missing', async () => {
    customFieldDefinition.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('create throws BadRequestException for a SELECT field with no options', () => {
    expect(() =>
      service.create('tenant-1', { entityType: 'ENTITY', fieldKey: 'tier', label: 'Tier', fieldType: 'SELECT' }),
    ).toThrow(BadRequestException);
    expect(customFieldDefinition.create).not.toHaveBeenCalled();
  });

  it('create scopes the definition to the tenant', async () => {
    customFieldDefinition.create.mockResolvedValue({ id: 'f1' });

    await service.create('tenant-1', {
      entityType: 'ENTITY',
      fieldKey: 'costCode',
      label: 'Cost Code',
      fieldType: 'TEXT',
    });

    expect(customFieldDefinition.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        entityType: 'ENTITY',
        fieldKey: 'costCode',
        label: 'Cost Code',
        fieldType: 'TEXT',
        selectOptions: [],
        required: false,
        displayOrder: 0,
      },
    });
  });

  describe('upsert / bulkCreate', () => {
    it('upsert keys on tenant + entityType + fieldKey', async () => {
      customFieldDefinition.upsert.mockResolvedValue({ id: 'f1' });

      await service.upsert('tenant-1', {
        entityType: 'ENTITY',
        fieldKey: 'costCode',
        label: 'Cost Code',
        fieldType: 'TEXT',
      });

      expect(customFieldDefinition.upsert).toHaveBeenCalledWith({
        where: { tenantId_entityType_fieldKey: { tenantId: 'tenant-1', entityType: 'ENTITY', fieldKey: 'costCode' } },
        create: expect.objectContaining({ tenantId: 'tenant-1', entityType: 'ENTITY', fieldKey: 'costCode' }),
        update: expect.objectContaining({ label: 'Cost Code' }),
      });
    });

    it('upsert throws BadRequestException for a SELECT field with no options', () => {
      expect(() =>
        service.upsert('tenant-1', { entityType: 'ENTITY', fieldKey: 'tier', label: 'Tier', fieldType: 'SELECT' }),
      ).toThrow(BadRequestException);
      expect(customFieldDefinition.upsert).not.toHaveBeenCalled();
    });

    it('bulkCreate reports a per-row error instead of throwing for an invalid row', async () => {
      const result = await service.bulkCreate('tenant-1', [{ entityType: 'ENTITY', fieldKey: 'tier', label: 'Tier', fieldType: 'SELECT' }]);

      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('bulkCreate upserts a valid row', async () => {
      customFieldDefinition.upsert.mockResolvedValue({ id: 'f1' });

      const result = await service.bulkCreate('tenant-1', [
        { entityType: 'ENTITY', fieldKey: 'costCode', label: 'Cost Code', fieldType: 'TEXT' },
      ]);

      expect(result).toEqual({ created: 1, errors: [] });
    });
  });
});
