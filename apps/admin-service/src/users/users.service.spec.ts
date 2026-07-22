import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
};

type UserRoleDelegateMock = {
  upsert: jest.Mock;
  delete: jest.Mock;
  findUnique: jest.Mock;
};

describe('UsersService', () => {
  let service: UsersService;
  let user: DelegateMock;
  let userRole: UserRoleDelegateMock;
  let role: DelegateMock;

  beforeEach(async () => {
    user = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };
    userRole = {
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    };
    role = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: { user, userRole, role } }],
    }).compile();

    service = module.get(UsersService);
  });

  it('findAll scopes the query by tenant and never selects the password field', async () => {
    user.findMany.mockResolvedValue([{ id: 'u1' }]);

    await service.findAll('tenant-1');

    const call = user.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ tenantId: 'tenant-1' });
    expect(call.select.password).toBeUndefined();
  });

  it('findOne throws NotFoundException when missing', async () => {
    user.findFirst.mockResolvedValue(null);

    await expect(service.findOne('tenant-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('create hashes the password before persisting and never returns it', async () => {
    user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    await service.create('tenant-1', {
      email: 'a@b.com',
      username: 'auser',
      fullName: 'A User',
      password: 'plaintext-password',
    });

    const call = user.create.mock.calls[0][0];
    expect(call.data.password).not.toBe('plaintext-password');
    expect(call.data.password.length).toBeGreaterThan(20);
    expect(call.select.password).toBeUndefined();
  });

  it('create wires a UserRole when roleId is provided', async () => {
    user.create.mockResolvedValue({ id: 'u1' });

    await service.create('tenant-1', {
      email: 'a@b.com',
      username: 'auser',
      fullName: 'A User',
      password: 'plaintext-password',
      roleId: 'role-1',
    });

    const call = user.create.mock.calls[0][0];
    expect(call.data.roles).toEqual({ create: { roleId: 'role-1' } });
  });

  it('update throws NotFoundException when the user does not exist', async () => {
    user.findFirst.mockResolvedValue(null);

    await expect(service.update('tenant-1', 'missing', { fullName: 'New' })).rejects.toThrow(NotFoundException);
    expect(user.update).not.toHaveBeenCalled();
  });

  it('update does not check admin count for non-status changes', async () => {
    user.findFirst.mockResolvedValue({ id: 'u1' });
    user.update.mockResolvedValue({ id: 'u1', fullName: 'New' });

    await service.update('tenant-1', 'u1', { fullName: 'New' });

    expect(role.findFirst).not.toHaveBeenCalled();
    expect(user.update).toHaveBeenCalled();
  });

  it('assignRole upserts with the given entityScope and groupScope', async () => {
    user.findFirst.mockResolvedValue({ id: 'u1' });
    userRole.upsert.mockResolvedValue({ userId: 'u1', roleId: 'role-1' });

    await service.assignRole('tenant-1', 'u1', { roleId: 'role-1', entityScope: ['e1', 'e2'], groupScope: ['g1'] });

    expect(userRole.upsert).toHaveBeenCalledWith({
      where: { userId_roleId: { userId: 'u1', roleId: 'role-1' } },
      create: { userId: 'u1', roleId: 'role-1', entityScope: ['e1', 'e2'], groupScope: ['g1'] },
      update: { entityScope: ['e1', 'e2'], groupScope: ['g1'] },
      include: { role: true },
    });
  });

  it('removeRole deletes after verifying the user exists', async () => {
    user.findFirst.mockResolvedValue({ id: 'u1' });
    role.findFirst.mockResolvedValue(null); // role being removed isn't Tenant Administrator (or doesn't exist)

    await service.removeRole('tenant-1', 'u1', 'role-1');

    expect(userRole.delete).toHaveBeenCalledWith({ where: { userId_roleId: { userId: 'u1', roleId: 'role-1' } } });
  });

  describe('BR-ADM-001: at least one active Tenant Administrator must remain', () => {
    it('update blocks deactivating the last active Tenant Administrator', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'admin-role' });
      userRole.findUnique.mockResolvedValue({ userId: 'u1', roleId: 'admin-role' });
      user.count.mockResolvedValue(1);

      await expect(service.update('tenant-1', 'u1', { status: 'inactive' })).rejects.toThrow(BadRequestException);
      expect(user.update).not.toHaveBeenCalled();
    });

    it('update allows deactivating an admin when other active admins remain', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'admin-role' });
      userRole.findUnique.mockResolvedValue({ userId: 'u1', roleId: 'admin-role' });
      user.count.mockResolvedValue(2);
      user.update.mockResolvedValue({ id: 'u1', status: 'inactive' });

      await service.update('tenant-1', 'u1', { status: 'inactive' });

      expect(user.update).toHaveBeenCalled();
    });

    it('update allows deactivating a user who is not a Tenant Administrator', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'admin-role' });
      userRole.findUnique.mockResolvedValue(null);
      user.update.mockResolvedValue({ id: 'u1', status: 'inactive' });

      await service.update('tenant-1', 'u1', { status: 'inactive' });

      expect(user.count).not.toHaveBeenCalled();
      expect(user.update).toHaveBeenCalled();
    });

    it('remove blocks deleting the last active Tenant Administrator', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'admin-role' });
      userRole.findUnique.mockResolvedValue({ userId: 'u1', roleId: 'admin-role' });
      user.count.mockResolvedValue(1);

      await expect(service.remove('tenant-1', 'u1')).rejects.toThrow(BadRequestException);
      expect(user.delete).not.toHaveBeenCalled();
    });

    it('remove allows deleting a non-administrator user', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'admin-role' });
      userRole.findUnique.mockResolvedValue(null);

      await service.remove('tenant-1', 'u1');

      expect(user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('removeRole blocks removing the Tenant Administrator role from the last active admin', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'admin-role', name: 'Tenant Administrator' });
      userRole.findUnique.mockResolvedValue({ userId: 'u1', roleId: 'admin-role' });
      user.count.mockResolvedValue(1);

      await expect(service.removeRole('tenant-1', 'u1', 'admin-role')).rejects.toThrow(BadRequestException);
      expect(userRole.delete).not.toHaveBeenCalled();
    });

    it('removeRole allows removing a non-administrator role without checking admin count', async () => {
      user.findFirst.mockResolvedValue({ id: 'u1' });
      role.findFirst.mockResolvedValue({ id: 'other-role', name: 'Reporting Analyst' });

      await service.removeRole('tenant-1', 'u1', 'other-role');

      expect(userRole.findUnique).not.toHaveBeenCalled();
      expect(userRole.delete).toHaveBeenCalledWith({ where: { userId_roleId: { userId: 'u1', roleId: 'other-role' } } });
    });
  });
});
