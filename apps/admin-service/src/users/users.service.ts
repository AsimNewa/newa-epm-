import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AssignUserRoleDto, CreateUserDto, UpdateUserDto } from '@newa-epm/shared';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const TENANT_ADMINISTRATOR_ROLE = 'Tenant Administrator';

const USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  username: true,
  fullName: true,
  status: true,
  mfaEnabled: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  roles: { include: { role: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: USER_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        password,
        roles: dto.roleId ? { create: { roleId: dto.roleId } } : undefined,
      },
      select: USER_SELECT,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, id);

    if (dto.status && dto.status !== 'active') {
      await this.assertNotLastActiveTenantAdministrator(tenantId, id);
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOne(tenantId, id);
    await this.assertNotLastActiveTenantAdministrator(tenantId, id);
    await this.prisma.user.delete({ where: { id } });
  }

  async assignRole(tenantId: string, userId: string, dto: AssignUserRoleDto) {
    await this.findOne(tenantId, userId);

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: dto.roleId } },
      create: { userId, roleId: dto.roleId, entityScope: dto.entityScope ?? [], groupScope: dto.groupScope ?? [] },
      update: { entityScope: dto.entityScope ?? [], groupScope: dto.groupScope ?? [] },
      include: { role: true },
    });
  }

  async removeRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    await this.findOne(tenantId, userId);

    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (role?.name === TENANT_ADMINISTRATOR_ROLE) {
      await this.assertNotLastActiveTenantAdministrator(tenantId, userId);
    }

    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
  }

  /** BR-ADM-001: the system must have at least one active Tenant Administrator at all times. */
  private async assertNotLastActiveTenantAdministrator(tenantId: string, userId: string): Promise<void> {
    const adminRole = await this.prisma.role.findFirst({
      where: { tenantId, name: TENANT_ADMINISTRATOR_ROLE },
    });

    if (!adminRole) {
      return;
    }

    const targetHasRole = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: adminRole.id } },
    });

    if (!targetHasRole) {
      return;
    }

    const activeAdminCount = await this.prisma.user.count({
      where: { tenantId, status: 'active', roles: { some: { roleId: adminRole.id } } },
    });

    if (activeAdminCount <= 1) {
      throw new BadRequestException('At least one active Tenant Administrator must remain (BR-ADM-001)');
    }
  }
}
