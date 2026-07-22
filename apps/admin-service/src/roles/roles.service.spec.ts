import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
};

type RolePermissionDelegateMock = {
  deleteMany: jest.Mock;
  createMany: jest.Mock;
};

describe('RolesService', () => {
  let service: RolesService;
  let role: DelegateMock;
  let rolePermission: RolePermissionDelegateMock;
  let $transaction: jest.Mock;

  beforeEach(async () => {
    role = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };
    rolePermission = {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    };
    $transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));

    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: { role, rolePermission, $transaction } }],
    }).compile();

    service = module.get(RolesService);
  });

  it('findOne throws NotFoundException when missing', async () => {
    role.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('create scopes the role to the tenant', async () => {
    role.create.mockResolvedValue({ id: 'r1' });

    await service.create('tenant-1', { name: 'Auditor', description: 'Read-only' });

    expect(role.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', name: 'Auditor', description: 'Read-only', mfaRequired: false },
    });
  });

  it('update throws BadRequestException for system roles when changing name/description/status', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: true, _count: { users: 0 } });

    await expect(service.update('tenant-1', 'r1', { name: 'New name' })).rejects.toThrow(BadRequestException);
    expect(role.update).not.toHaveBeenCalled();
  });

  it('update allows toggling mfaRequired on a system role', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: true, _count: { users: 0 } });
    role.update.mockResolvedValue({ id: 'r1', mfaRequired: true });

    await service.update('tenant-1', 'r1', { mfaRequired: true });

    expect(role.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { mfaRequired: true } });
  });

  it('update succeeds for custom roles', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: false, _count: { users: 0 } });
    role.update.mockResolvedValue({ id: 'r1', name: 'New name' });

    await service.update('tenant-1', 'r1', { name: 'New name' });

    expect(role.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { name: 'New name' } });
  });

  it('remove throws BadRequestException for system roles', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: true, _count: { users: 0 } });

    await expect(service.remove('tenant-1', 'r1')).rejects.toThrow(BadRequestException);
    expect(role.delete).not.toHaveBeenCalled();
  });

  it('remove throws BadRequestException when the role has assigned users', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: false, _count: { users: 2 } });

    await expect(service.remove('tenant-1', 'r1')).rejects.toThrow(BadRequestException);
    expect(role.delete).not.toHaveBeenCalled();
  });

  it('remove deletes a custom role with no assigned users', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: false, _count: { users: 0 } });

    await service.remove('tenant-1', 'r1');

    expect(role.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('setPermissions replaces the permission set transactionally', async () => {
    role.findFirst
      .mockResolvedValueOnce({ id: 'r1', isSystem: false, _count: { users: 0 } })
      .mockResolvedValueOnce({ id: 'r1', isSystem: false, _count: { users: 0 }, permissions: [] });

    await service.setPermissions('tenant-1', 'r1', { permissionIds: ['p1', 'p2'] });

    expect($transaction).toHaveBeenCalled();
    expect(rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'r1' } });
    expect(rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 'r1', permissionId: 'p1' },
        { roleId: 'r1', permissionId: 'p2' },
      ],
      skipDuplicates: true,
    });
  });

  it('setPermissions throws BadRequestException for system roles', async () => {
    role.findFirst.mockResolvedValue({ id: 'r1', isSystem: true, _count: { users: 0 } });

    await expect(service.setPermissions('tenant-1', 'r1', { permissionIds: [] })).rejects.toThrow(
      BadRequestException,
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  describe('upsert / bulkCreate', () => {
    it('upsert creates a new role scoped to the tenant when none exists', async () => {
      role.findUnique.mockResolvedValue(null);
      role.upsert.mockResolvedValue({ id: 'r1' });

      await service.upsert('tenant-1', { name: 'Auditor', description: 'Read-only' });

      expect(role.upsert).toHaveBeenCalledWith({
        where: { tenantId_name: { tenantId: 'tenant-1', name: 'Auditor' } },
        create: { tenantId: 'tenant-1', name: 'Auditor', description: 'Read-only', mfaRequired: false },
        update: { description: 'Read-only', mfaRequired: false },
      });
    });

    it('upsert throws BadRequestException when the name matches an existing system role', async () => {
      role.findUnique.mockResolvedValue({ id: 'r1', isSystem: true });

      await expect(service.upsert('tenant-1', { name: 'Tenant Administrator' })).rejects.toThrow(
        BadRequestException,
      );
      expect(role.upsert).not.toHaveBeenCalled();
    });

    it('bulkCreate reports a per-row error instead of throwing when a row targets a system role', async () => {
      role.findUnique.mockResolvedValue({ id: 'r1', isSystem: true });

      const result = await service.bulkCreate('tenant-1', [{ name: 'Tenant Administrator' }]);

      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });
});
