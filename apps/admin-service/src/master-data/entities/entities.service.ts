import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEntityDto, ImportResult, UpdateEntityDto } from '@newa-epm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';
import { bulkImport } from '../../common/bulk-import.util';

@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFields: CustomFieldsService,
  ) {}

  findAll(tenantId: string, periodId: string) {
    return this.prisma.entity.findMany({
      where: { tenantId, periodId },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(tenantId: string, periodId: string, id: string) {
    const entity = await this.prisma.entity.findFirst({ where: { id, tenantId, periodId } });

    if (!entity) {
      throw new NotFoundException(`Entity ${id} not found`);
    }

    return entity;
  }

  async create(tenantId: string, periodId: string, dto: CreateEntityDto) {
    await this.customFields.assertValid(tenantId, 'ENTITY', dto.customFields);

    return this.prisma.entity.create({
      data: {
        tenantId,
        periodId,
        code: dto.code,
        name: dto.name,
        country: dto.country,
        currency: dto.currency,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(tenantId: string, periodId: string, id: string, dto: UpdateEntityDto) {
    await this.findOne(tenantId, periodId, id);

    if (dto.customFields) {
      await this.customFields.assertValid(tenantId, 'ENTITY', dto.customFields);
    }

    return this.prisma.entity.update({
      where: { id },
      data: dto as Prisma.EntityUncheckedUpdateInput,
    });
  }

  async remove(tenantId: string, periodId: string, id: string): Promise<void> {
    await this.findOne(tenantId, periodId, id);
    await this.prisma.entity.delete({ where: { id } });
  }

  /** Import/upsert: creates the entity if the code is new, updates it if it already exists. */
  async upsert(tenantId: string, periodId: string, dto: CreateEntityDto) {
    await this.customFields.assertValid(tenantId, 'ENTITY', dto.customFields);

    return this.prisma.entity.upsert({
      where: { tenantId_periodId_code: { tenantId, periodId, code: dto.code } },
      create: {
        tenantId,
        periodId,
        code: dto.code,
        name: dto.name,
        country: dto.country,
        currency: dto.currency,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
      update: {
        name: dto.name,
        country: dto.country,
        currency: dto.currency,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Bulk import: each row is upserted (create-or-update) so re-importing existing codes updates them. */
  bulkCreate(tenantId: string, periodId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateEntityDto, rows, (dto) => this.upsert(tenantId, periodId, dto));
  }
}
