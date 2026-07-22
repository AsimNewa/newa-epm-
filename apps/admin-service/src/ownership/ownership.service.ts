import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateConsolidationGroupDto,
  CreateGroupMemberDto,
  CreateOwnershipPeriodDto,
  CreateOwnershipStructureEntryDto,
  ImportOwnershipStructureRowDto,
  ImportResult,
  UpdateConsolidationGroupDto,
  UpdateGroupMemberDto,
  UpdateOwnershipPeriodDto,
  UpdateOwnershipStructureEntryDto,
} from '@newa-epm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { bulkImport } from '../common/bulk-import.util';

@Injectable()
export class OwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFields: CustomFieldsService,
  ) {}

  findAllGroups(tenantId: string, periodId: string) {
    return this.prisma.consolidationGroup.findMany({
      where: { tenantId, periodId },
      include: { members: { include: { entity: true } }, parentEntity: true },
      orderBy: { code: 'asc' },
    });
  }

  async findGroup(tenantId: string, periodId: string, id: string) {
    const group = await this.prisma.consolidationGroup.findFirst({
      where: { id, tenantId, periodId },
      include: { members: { include: { entity: true } }, parentEntity: true },
    });

    if (!group) {
      throw new NotFoundException(`Consolidation group ${id} not found`);
    }

    return group;
  }

  async createGroup(tenantId: string, periodId: string, dto: CreateConsolidationGroupDto) {
    await this.customFields.assertValid(tenantId, 'CONSOLIDATION_GROUP', dto.customFields);

    return this.prisma.consolidationGroup.create({
      data: {
        tenantId,
        periodId,
        code: dto.code,
        name: dto.name,
        reportingCurrency: dto.reportingCurrency,
        parentEntityId: dto.parentEntityId,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateGroup(tenantId: string, periodId: string, id: string, dto: UpdateConsolidationGroupDto) {
    await this.findGroup(tenantId, periodId, id);

    if (dto.customFields) {
      await this.customFields.assertValid(tenantId, 'CONSOLIDATION_GROUP', dto.customFields);
    }

    return this.prisma.consolidationGroup.update({
      where: { id },
      data: dto as Prisma.ConsolidationGroupUncheckedUpdateInput,
    });
  }

  async removeGroup(tenantId: string, periodId: string, id: string): Promise<void> {
    await this.findGroup(tenantId, periodId, id);
    await this.prisma.consolidationGroup.delete({ where: { id } });
  }

  async upsertGroup(tenantId: string, periodId: string, dto: CreateConsolidationGroupDto) {
    await this.customFields.assertValid(tenantId, 'CONSOLIDATION_GROUP', dto.customFields);

    return this.prisma.consolidationGroup.upsert({
      where: { tenantId_periodId_code: { tenantId, periodId, code: dto.code } },
      create: {
        tenantId,
        periodId,
        code: dto.code,
        name: dto.name,
        reportingCurrency: dto.reportingCurrency,
        parentEntityId: dto.parentEntityId,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
      update: {
        name: dto.name,
        reportingCurrency: dto.reportingCurrency,
        parentEntityId: dto.parentEntityId,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  bulkCreateGroups(tenantId: string, periodId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateConsolidationGroupDto, rows, (dto) => this.upsertGroup(tenantId, periodId, dto));
  }

  async findMember(tenantId: string, periodId: string, groupId: string, memberId: string) {
    await this.findGroup(tenantId, periodId, groupId);

    const member = await this.prisma.groupEntity.findFirst({
      where: { id: memberId, groupId },
      include: { entity: true },
    });

    if (!member) {
      throw new NotFoundException(`Group member ${memberId} not found`);
    }

    return member;
  }

  async createMember(tenantId: string, periodId: string, groupId: string, dto: CreateGroupMemberDto) {
    await this.findGroup(tenantId, periodId, groupId);

    return this.prisma.groupEntity.create({
      data: {
        groupId,
        entityId: dto.entityId,
        consolidationMethod: dto.consolidationMethod,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
      include: { entity: true },
    });
  }

  async updateMember(tenantId: string, periodId: string, groupId: string, memberId: string, dto: UpdateGroupMemberDto) {
    await this.findMember(tenantId, periodId, groupId, memberId);

    return this.prisma.groupEntity.update({
      where: { id: memberId },
      data: {
        consolidationMethod: dto.consolidationMethod,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
      include: { entity: true },
    });
  }

  async removeMember(tenantId: string, periodId: string, groupId: string, memberId: string): Promise<void> {
    await this.findMember(tenantId, periodId, groupId, memberId);
    await this.prisma.groupEntity.delete({ where: { id: memberId } });
  }

  async findAllOwnershipPeriods(tenantId: string, periodId: string, groupId: string) {
    await this.findGroup(tenantId, periodId, groupId);

    return this.prisma.ownershipPeriod.findMany({
      where: { groupId, tenantId },
      include: { parentEntity: true, subsidiaryEntity: true, effectiveFromPeriod: true, effectiveToPeriod: true },
      orderBy: { effectiveFromPeriod: { startDate: 'desc' } },
    });
  }

  async findOwnershipPeriod(tenantId: string, periodId: string, groupId: string, id: string) {
    await this.findGroup(tenantId, periodId, groupId);

    const ownershipPeriod = await this.prisma.ownershipPeriod.findFirst({
      where: { id, groupId, tenantId },
      include: { parentEntity: true, subsidiaryEntity: true, effectiveFromPeriod: true, effectiveToPeriod: true },
    });

    if (!ownershipPeriod) {
      throw new NotFoundException(`Ownership period ${id} not found`);
    }

    return ownershipPeriod;
  }

  /** Resolves a period by id within the tenant, or throws. Used to validate effective-from/to FKs. */
  private async resolvePeriod(tenantId: string, id: string) {
    const period = await this.prisma.period.findFirst({ where: { id, tenantId } });

    if (!period) {
      throw new BadRequestException(`Period ${id} does not exist`);
    }

    return period;
  }

  private async assertChronologicalOrder(
    tenantId: string,
    fromPeriodId: string,
    toPeriodId: string | undefined,
  ): Promise<void> {
    if (!toPeriodId) {
      return;
    }

    const [fromPeriod, toPeriod] = await Promise.all([
      this.resolvePeriod(tenantId, fromPeriodId),
      this.resolvePeriod(tenantId, toPeriodId),
    ]);

    if (toPeriod.startDate < fromPeriod.startDate) {
      throw new BadRequestException('effectiveToPeriodId must not be earlier than effectiveFromPeriodId');
    }
  }

  async createOwnershipPeriod(tenantId: string, periodId: string, groupId: string, dto: CreateOwnershipPeriodDto) {
    await this.findGroup(tenantId, periodId, groupId);
    await this.resolvePeriod(tenantId, dto.effectiveFromPeriodId);
    await this.assertChronologicalOrder(tenantId, dto.effectiveFromPeriodId, dto.effectiveToPeriodId);

    return this.prisma.ownershipPeriod.create({
      data: {
        tenantId,
        groupId,
        parentEntityId: dto.parentEntityId,
        subsidiaryEntityId: dto.subsidiaryEntityId,
        directPercentage: dto.directPercentage,
        effectivePercentage: dto.effectivePercentage ?? dto.directPercentage,
        nciPercentage: dto.nciPercentage ?? 100 - dto.directPercentage,
        effectiveFromPeriodId: dto.effectiveFromPeriodId,
        effectiveToPeriodId: dto.effectiveToPeriodId,
        acquisitionCost: dto.acquisitionCost,
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
      },
      include: { parentEntity: true, subsidiaryEntity: true, effectiveFromPeriod: true, effectiveToPeriod: true },
    });
  }

  async updateOwnershipPeriod(
    tenantId: string,
    periodId: string,
    groupId: string,
    id: string,
    dto: UpdateOwnershipPeriodDto,
  ) {
    const existing = await this.findOwnershipPeriod(tenantId, periodId, groupId, id);
    await this.assertChronologicalOrder(tenantId, existing.effectiveFromPeriodId, dto.effectiveToPeriodId);

    return this.prisma.ownershipPeriod.update({
      where: { id },
      data: dto,
      include: { parentEntity: true, subsidiaryEntity: true, effectiveFromPeriod: true, effectiveToPeriod: true },
    });
  }

  async removeOwnershipPeriod(tenantId: string, periodId: string, groupId: string, id: string): Promise<void> {
    await this.findOwnershipPeriod(tenantId, periodId, groupId, id);
    await this.prisma.ownershipPeriod.delete({ where: { id } });
  }

  // ==================== Unified Ownership Structure ====================
  // One "entry" = one OwnershipPeriod row + its associated GroupEntity row (which holds
  // consolidationMethod). The two are kept in sync here so the UI can present/edit them as a
  // single row, without any Prisma schema change — GroupEntity.effectiveFrom is always set to
  // the chosen effectiveFromPeriod's startDate, so the two tables can be joined/upserted by
  // GroupEntity's real unique key (groupId, entityId, effectiveFrom) instead of a fuzzy scan.

  async findAllOwnershipStructure(tenantId: string, periodId: string, groupId: string) {
    await this.findGroup(tenantId, periodId, groupId);

    const [ownershipPeriods, members] = await Promise.all([
      this.prisma.ownershipPeriod.findMany({
        where: { groupId, tenantId },
        include: { parentEntity: true, subsidiaryEntity: true, effectiveFromPeriod: true, effectiveToPeriod: true },
        orderBy: { effectiveFromPeriod: { startDate: 'desc' } },
      }),
      this.prisma.groupEntity.findMany({ where: { groupId } }),
    ]);

    const memberByKey = new Map(members.map((m) => [`${m.entityId}|${m.effectiveFrom.toISOString()}`, m]));

    return ownershipPeriods.map((op) => {
      const member = memberByKey.get(`${op.subsidiaryEntityId}|${op.effectiveFromPeriod.startDate.toISOString()}`);
      return { ...op, consolidationMethod: member?.consolidationMethod ?? 'FULL' };
    });
  }

  async findOwnershipStructureEntry(tenantId: string, periodId: string, groupId: string, id: string) {
    const ownershipPeriod = await this.findOwnershipPeriod(tenantId, periodId, groupId, id);
    const member = await this.prisma.groupEntity.findUnique({
      where: {
        groupId_entityId_effectiveFrom: {
          groupId,
          entityId: ownershipPeriod.subsidiaryEntityId,
          effectiveFrom: ownershipPeriod.effectiveFromPeriod.startDate,
        },
      },
    });

    return { ...ownershipPeriod, consolidationMethod: member?.consolidationMethod ?? 'FULL' };
  }

  async createOwnershipStructureEntry(
    tenantId: string,
    periodId: string,
    groupId: string,
    dto: CreateOwnershipStructureEntryDto,
  ) {
    await this.findGroup(tenantId, periodId, groupId);
    const fromPeriod = await this.resolvePeriod(tenantId, dto.effectiveFromPeriodId);
    await this.assertChronologicalOrder(tenantId, dto.effectiveFromPeriodId, dto.effectiveToPeriodId);
    const toPeriod = dto.effectiveToPeriodId ? await this.resolvePeriod(tenantId, dto.effectiveToPeriodId) : undefined;

    const created = await this.prisma.$transaction(async (tx) => {
      // Upsert (not create) so re-importing the same subsidiary/parent/effective-from-period
      // combination updates the existing entry instead of throwing a unique-constraint error —
      // mirrors upsertGroup's idempotent-re-import pattern above.
      const ownershipPeriodData = {
        directPercentage: dto.directPercentage,
        effectivePercentage: dto.effectivePercentage ?? dto.directPercentage,
        nciPercentage: dto.nciPercentage ?? 100 - dto.directPercentage,
        effectiveToPeriodId: dto.effectiveToPeriodId,
        acquisitionCost: dto.acquisitionCost,
        acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
      };

      const ownershipPeriod = await tx.ownershipPeriod.upsert({
        where: {
          tenantId_groupId_parentEntityId_subsidiaryEntityId_effectiveFromPeriodId: {
            tenantId,
            groupId,
            parentEntityId: dto.parentEntityId,
            subsidiaryEntityId: dto.subsidiaryEntityId,
            effectiveFromPeriodId: dto.effectiveFromPeriodId,
          },
        },
        create: {
          tenantId,
          groupId,
          parentEntityId: dto.parentEntityId,
          subsidiaryEntityId: dto.subsidiaryEntityId,
          effectiveFromPeriodId: dto.effectiveFromPeriodId,
          ...ownershipPeriodData,
        },
        update: ownershipPeriodData,
      });

      await tx.groupEntity.upsert({
        where: {
          groupId_entityId_effectiveFrom: {
            groupId,
            entityId: dto.subsidiaryEntityId,
            effectiveFrom: fromPeriod.startDate,
          },
        },
        create: {
          groupId,
          entityId: dto.subsidiaryEntityId,
          consolidationMethod: dto.consolidationMethod,
          effectiveFrom: fromPeriod.startDate,
          effectiveTo: toPeriod?.endDate,
        },
        update: {
          consolidationMethod: dto.consolidationMethod,
          effectiveTo: toPeriod?.endDate,
        },
      });

      return ownershipPeriod;
    });

    return this.findOwnershipStructureEntry(tenantId, periodId, groupId, created.id);
  }

  async updateOwnershipStructureEntry(
    tenantId: string,
    periodId: string,
    groupId: string,
    id: string,
    dto: UpdateOwnershipStructureEntryDto,
  ) {
    const existing = await this.findOwnershipPeriod(tenantId, periodId, groupId, id);
    await this.assertChronologicalOrder(tenantId, existing.effectiveFromPeriodId, dto.effectiveToPeriodId);
    const toPeriod = dto.effectiveToPeriodId ? await this.resolvePeriod(tenantId, dto.effectiveToPeriodId) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.ownershipPeriod.update({
        where: { id },
        data: {
          directPercentage: dto.directPercentage,
          effectivePercentage: dto.effectivePercentage,
          nciPercentage: dto.nciPercentage,
          effectiveToPeriodId: dto.effectiveToPeriodId,
          acquisitionCost: dto.acquisitionCost,
          acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
        },
      });

      await tx.groupEntity.upsert({
        where: {
          groupId_entityId_effectiveFrom: {
            groupId,
            entityId: existing.subsidiaryEntityId,
            effectiveFrom: existing.effectiveFromPeriod.startDate,
          },
        },
        create: {
          groupId,
          entityId: existing.subsidiaryEntityId,
          consolidationMethod: dto.consolidationMethod ?? 'FULL',
          effectiveFrom: existing.effectiveFromPeriod.startDate,
          effectiveTo: toPeriod?.endDate,
        },
        update: {
          ...(dto.consolidationMethod ? { consolidationMethod: dto.consolidationMethod } : {}),
          effectiveTo: toPeriod?.endDate,
        },
      });
    });

    return this.findOwnershipStructureEntry(tenantId, periodId, groupId, id);
  }

  async removeOwnershipStructureEntry(tenantId: string, periodId: string, groupId: string, id: string): Promise<void> {
    const existing = await this.findOwnershipPeriod(tenantId, periodId, groupId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.ownershipPeriod.delete({ where: { id } });

      const stillReferenced = await tx.ownershipPeriod.findFirst({
        where: {
          groupId,
          subsidiaryEntityId: existing.subsidiaryEntityId,
          effectiveFromPeriod: { startDate: existing.effectiveFromPeriod.startDate },
        },
      });

      if (!stillReferenced) {
        await tx.groupEntity.deleteMany({
          where: {
            groupId,
            entityId: existing.subsidiaryEntityId,
            effectiveFrom: existing.effectiveFromPeriod.startDate,
          },
        });
      }
    });
  }

  /** Resolves an entity by its business code within the tenant+period scope, or throws. */
  private async resolveEntityByCode(tenantId: string, periodId: string, code: string) {
    const entity = await this.prisma.entity.findUnique({
      where: { tenantId_periodId_code: { tenantId, periodId, code } },
    });

    if (!entity) {
      throw new BadRequestException(`Entity ${code} does not exist`);
    }

    return entity;
  }

  /** Resolves a period by its business code within the tenant, or throws. */
  private async resolvePeriodByCode(tenantId: string, code: string) {
    const period = await this.prisma.period.findUnique({
      where: { tenantId_period: { tenantId, period: code } },
    });

    if (!period) {
      throw new BadRequestException(`Period ${code} does not exist`);
    }

    return period;
  }

  bulkImportOwnershipStructure(
    tenantId: string,
    periodId: string,
    groupId: string,
    rows: Record<string, unknown>[],
  ): Promise<ImportResult> {
    return bulkImport(ImportOwnershipStructureRowDto, rows, async (row) => {
      const [subsidiary, parent, fromPeriod] = await Promise.all([
        this.resolveEntityByCode(tenantId, periodId, row.subsidiaryEntityCode),
        this.resolveEntityByCode(tenantId, periodId, row.parentEntityCode),
        this.resolvePeriodByCode(tenantId, row.effectiveFromPeriod),
      ]);
      const toPeriod = row.effectiveToPeriod
        ? await this.resolvePeriodByCode(tenantId, row.effectiveToPeriod)
        : undefined;

      return this.createOwnershipStructureEntry(tenantId, periodId, groupId, {
        subsidiaryEntityId: subsidiary.id,
        parentEntityId: parent.id,
        consolidationMethod: row.consolidationMethod,
        directPercentage: row.directPercentage,
        effectivePercentage: row.effectivePercentage,
        nciPercentage: row.nciPercentage,
        effectiveFromPeriodId: fromPeriod.id,
        effectiveToPeriodId: toPeriod?.id,
        acquisitionCost: row.acquisitionCost,
        acquisitionDate: row.acquisitionDate,
      });
    });
  }
}
