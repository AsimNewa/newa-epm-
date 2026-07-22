import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleDto, ImportResult, SetRolePermissionsDto, UpdateRoleDto } from '@newa-epm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { bulkImport } from '../common/bulk-import.util';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return role;
  }

  create(tenantId: string, dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: { tenantId, name: dto.name, description: dto.description, mfaRequired: dto.mfaRequired ?? false },
    });
  }

  async upsert(tenantId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { tenantId_name: { tenantId, name: dto.name } } });

    if (existing?.isSystem) {
      throw new BadRequestException(`"${dto.name}" is a system role and cannot be modified via import.`);
    }

    return this.prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: dto.name } },
      create: { tenantId, name: dto.name, description: dto.description, mfaRequired: dto.mfaRequired ?? false },
      update: { description: dto.description, mfaRequired: dto.mfaRequired ?? false },
    });
  }

  bulkCreate(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateRoleDto, rows, (dto) => this.upsert(tenantId, dto));
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(tenantId, id);

    if (role.isSystem) {
      // System roles are locked except for the MFA Policy toggle (spec 3.1.5: "MFA Policy: Required/optional by role").
      const { name, description, status, ...allowed } = dto;
      if (name !== undefined || description !== undefined || status !== undefined) {
        throw new BadRequestException('System roles cannot be modified, except for the MFA requirement');
      }

      return this.prisma.role.update({ where: { id }, data: allowed });
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const role = await this.findOne(tenantId, id);

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    if (role._count.users > 0) {
      throw new BadRequestException('Cannot delete a role that has assigned users');
    }

    await this.prisma.role.delete({ where: { id } });
  }

  async setPermissions(tenantId: string, id: string, dto: SetRolePermissionsDto) {
    const role = await this.findOne(tenantId, id);

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      }),
    ]);

    return this.findOne(tenantId, id);
  }
}
