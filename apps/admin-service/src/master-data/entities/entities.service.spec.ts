import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntitiesService } from './entities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';

type EntityDelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('EntitiesService', () => {
  let service: EntitiesService;
  let entity: EntityDelegateMock;
  let customFields: { assertValid: jest.Mock };

  beforeEach(async () => {
    entity = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    customFields = { assertValid: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitiesService,
        { provide: PrismaService, useValue: { entity } },
        { provide: CustomFieldsService, useValue: customFields },
      ],
    }).compile();

    service = module.get(EntitiesService);
  });

  it('findAll scopes the query by tenant and period', async () => {
    entity.findMany.mockResolvedValue([{ id: 'e1' }]);

    const result = await service.findAll('tenant-1', 'period-1');

    expect(entity.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', periodId: 'period-1' },
      orderBy: { code: 'asc' },
    });
    expect(result).toEqual([{ id: 'e1' }]);
  });

  it('findOne returns the entity when it belongs to the tenant and period', async () => {
    entity.findFirst.mockResolvedValue({ id: 'e1', tenantId: 'tenant-1' });

    const result = await service.findOne('tenant-1', 'period-1', 'e1');

    expect(entity.findFirst).toHaveBeenCalledWith({
      where: { id: 'e1', tenantId: 'tenant-1', periodId: 'period-1' },
    });
    expect(result).toEqual({ id: 'e1', tenantId: 'tenant-1' });
  });

  it('findOne throws NotFoundException when the entity does not exist', async () => {
    entity.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'period-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('create persists the entity scoped to the tenant and period', async () => {
    entity.create.mockResolvedValue({ id: 'e1' });

    await service.create('tenant-1', 'period-1', { code: 'E1', name: 'Entity One', currency: 'USD' });

    expect(entity.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        periodId: 'period-1',
        code: 'E1',
        name: 'Entity One',
        country: undefined,
        currency: 'USD',
      },
    });
  });

  it('update throws NotFoundException when the entity does not exist', async () => {
    entity.findFirst.mockResolvedValue(null);

    await expect(service.update('tenant-1', 'period-1', 'missing', { name: 'New name' })).rejects.toThrow(
      NotFoundException,
    );
    expect(entity.update).not.toHaveBeenCalled();
  });

  it('update persists changes when the entity exists', async () => {
    entity.findFirst.mockResolvedValue({ id: 'e1', tenantId: 'tenant-1' });
    entity.update.mockResolvedValue({ id: 'e1', name: 'New name' });

    const result = await service.update('tenant-1', 'period-1', 'e1', { name: 'New name' });

    expect(entity.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { name: 'New name' } });
    expect(result).toEqual({ id: 'e1', name: 'New name' });
  });

  it('remove deletes the entity after verifying it exists', async () => {
    entity.findFirst.mockResolvedValue({ id: 'e1', tenantId: 'tenant-1' });

    await service.remove('tenant-1', 'period-1', 'e1');

    expect(entity.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });

  it('remove throws NotFoundException without deleting when the entity does not exist', async () => {
    entity.findFirst.mockResolvedValue(null);

    await expect(service.remove('tenant-1', 'period-1', 'missing')).rejects.toThrow(NotFoundException);
    expect(entity.delete).not.toHaveBeenCalled();
  });
});
