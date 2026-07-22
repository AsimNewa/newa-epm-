import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateDimensionDto,
  CreateDimensionMemberDto,
  CreateDimensionMemberImportDto,
  ImportResult,
  UpdateDimensionDto,
  UpdateDimensionMemberDto,
} from '@newa-epm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';
import { bulkImport } from '../../common/bulk-import.util';
import {
  FLOW_CODE_ACCOUNT_RULES,
  FLOW_CODE_DIMENSION_NAME,
  FLOW_CODE_DIMENSION_TYPE,
  FLOW_CODE_MEMBERS,
} from './flow-code.seed';

@Injectable()
export class DimensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFields: CustomFieldsService,
  ) {}

  /**
   * FlowCode is a protected system dimension that must always exist (see flow-code.seed.ts).
   * Provisioning here — rather than only at tenant/period setup — makes it self-healing for any
   * period, including ones created before this feature existed. Cheap in the steady state: one
   * findFirst, short-circuiting before the create cascade.
   */
  private async ensureFlowCodeDimension(tenantId: string, periodId: string): Promise<void> {
    const existing = await this.prisma.dimension.findFirst({
      where: { tenantId, periodId, name: FLOW_CODE_DIMENSION_NAME },
    });

    if (existing) {
      return;
    }

    const flowDimension = await this.prisma.dimension.create({
      data: { tenantId, periodId, name: FLOW_CODE_DIMENSION_NAME, type: FLOW_CODE_DIMENSION_TYPE, isSystem: true },
    });

    // Parents must be created before children — FLOW_CODE_MEMBERS is already in that order.
    for (const member of FLOW_CODE_MEMBERS) {
      await this.prisma.dimensionMember.create({
        data: {
          dimensionId: flowDimension.id,
          code: member.code,
          name: member.name,
          parentCode: member.parentCode,
          weight: member.weight,
        },
      });
    }

    // Per-account applicability + Cash/Non-Cash default, reviewed account-by-account (see flow-code.seed.ts).
    for (const rule of FLOW_CODE_ACCOUNT_RULES) {
      await this.prisma.dimensionAccountRule.create({
        data: {
          tenantId,
          periodId,
          dimensionId: flowDimension.id,
          applicability: rule.applicability,
          defaultMemberCode: rule.defaultMemberCode,
          conditions: { create: [{ sourceRange: rule.sourceRange }] },
        },
      });
    }
  }

  async findAll(tenantId: string, periodId: string) {
    await this.ensureFlowCodeDimension(tenantId, periodId);

    return this.prisma.dimension.findMany({
      where: { tenantId, periodId },
      include: { members: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, periodId: string, id: string) {
    const dimension = await this.prisma.dimension.findFirst({
      where: { id, tenantId, periodId },
      include: { members: true },
    });

    if (!dimension) {
      throw new NotFoundException(`Dimension ${id} not found`);
    }

    return dimension;
  }

  async create(tenantId: string, periodId: string, dto: CreateDimensionDto) {
    await this.customFields.assertValid(tenantId, 'DIMENSION', dto.customFields);

    return this.prisma.dimension.create({
      data: {
        tenantId,
        periodId,
        name: dto.name,
        type: dto.type,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(tenantId: string, periodId: string, id: string, dto: UpdateDimensionDto) {
    const existing = await this.findOne(tenantId, periodId, id);

    if (existing.isSystem && (dto.name !== undefined || dto.type !== undefined)) {
      throw new BadRequestException(`"${existing.name}" is a system dimension and cannot be renamed.`);
    }

    if (dto.customFields) {
      await this.customFields.assertValid(tenantId, 'DIMENSION', dto.customFields);
    }

    return this.prisma.dimension.update({
      where: { id },
      data: dto as Prisma.DimensionUncheckedUpdateInput,
    });
  }

  async remove(tenantId: string, periodId: string, id: string): Promise<void> {
    const existing = await this.findOne(tenantId, periodId, id);

    if (existing.isSystem) {
      throw new BadRequestException(`"${existing.name}" is a system dimension and cannot be deleted.`);
    }

    await this.prisma.dimension.delete({ where: { id } });
  }

  async upsert(tenantId: string, periodId: string, dto: CreateDimensionDto) {
    await this.customFields.assertValid(tenantId, 'DIMENSION', dto.customFields);

    return this.prisma.dimension.upsert({
      where: { tenantId_periodId_name: { tenantId, periodId, name: dto.name } },
      create: { tenantId, periodId, name: dto.name, type: dto.type, customFields: dto.customFields as Prisma.InputJsonValue | undefined },
      update: { type: dto.type, customFields: dto.customFields as Prisma.InputJsonValue | undefined },
    });
  }

  bulkCreate(tenantId: string, periodId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateDimensionDto, rows, (dto) => this.upsert(tenantId, periodId, dto));
  }

  private async assertDimensionExists(tenantId: string, periodId: string, dimensionId: string): Promise<void> {
    await this.findOne(tenantId, periodId, dimensionId);
  }

  private async assertParentExists(dimensionId: string, parentCode?: string, selfCode?: string): Promise<void> {
    if (!parentCode) {
      return;
    }

    if (parentCode === selfCode) {
      throw new BadRequestException('A dimension member cannot be its own parent');
    }

    const parent = await this.prisma.dimensionMember.findFirst({ where: { dimensionId, code: parentCode } });

    if (!parent) {
      throw new BadRequestException(
        `Parent member "${parentCode}" does not exist in this dimension. Create it as a member first — parents must exist before they can be selected as a parent.`,
      );
    }
  }

  async findMember(tenantId: string, periodId: string, dimensionId: string, memberId: string) {
    await this.assertDimensionExists(tenantId, periodId, dimensionId);

    const member = await this.prisma.dimensionMember.findFirst({
      where: { id: memberId, dimensionId },
    });

    if (!member) {
      throw new NotFoundException(`Dimension member ${memberId} not found`);
    }

    return member;
  }

  async createMember(tenantId: string, periodId: string, dimensionId: string, dto: CreateDimensionMemberDto) {
    await this.assertDimensionExists(tenantId, periodId, dimensionId);
    await this.assertParentExists(dimensionId, dto.parentCode, dto.code);

    return this.prisma.dimensionMember.create({
      data: { dimensionId, code: dto.code, name: dto.name, parentCode: dto.parentCode, weight: dto.weight ?? 1 },
    });
  }

  async updateMember(
    tenantId: string,
    periodId: string,
    dimensionId: string,
    memberId: string,
    dto: UpdateDimensionMemberDto,
  ) {
    const existing = await this.findMember(tenantId, periodId, dimensionId, memberId);
    await this.assertParentExists(dimensionId, dto.parentCode, existing.code);

    return this.prisma.dimensionMember.update({
      where: { id: memberId },
      data: dto,
    });
  }

  async removeMember(tenantId: string, periodId: string, dimensionId: string, memberId: string): Promise<void> {
    await this.findMember(tenantId, periodId, dimensionId, memberId);
    await this.prisma.dimensionMember.delete({ where: { id: memberId } });
  }

  // Callers must have already verified dimensionId belongs to this tenant/period
  // (its only caller, upsertMemberAcrossDimensions, does so via resolveDimensionByIdentifier).
  async upsertMember(dimensionId: string, dto: CreateDimensionMemberDto) {
    await this.assertParentExists(dimensionId, dto.parentCode, dto.code);

    return this.prisma.dimensionMember.upsert({
      where: { dimensionId_code: { dimensionId, code: dto.code } },
      create: { dimensionId, code: dto.code, name: dto.name, parentCode: dto.parentCode, weight: dto.weight ?? 1 },
      update: { name: dto.name, parentCode: dto.parentCode, weight: dto.weight ?? 1 },
    });
  }

  /** Resolves a "dimension" import-column value against Dimension.name or Dimension.type (case-insensitive). */
  private async resolveDimensionByIdentifier(tenantId: string, periodId: string, identifier: string) {
    const dimension = await this.prisma.dimension.findFirst({
      where: {
        tenantId,
        periodId,
        OR: [
          { name: { equals: identifier, mode: 'insensitive' } },
          { type: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!dimension) {
      throw new BadRequestException(
        `Dimension "${identifier}" not found. Check the "dimension" column — it must match an existing dimension's name or type.`,
      );
    }

    return dimension;
  }

  private async upsertMemberAcrossDimensions(
    tenantId: string,
    periodId: string,
    dto: CreateDimensionMemberImportDto,
  ) {
    const dimension = await this.resolveDimensionByIdentifier(tenantId, periodId, dto.dimension);
    return this.upsertMember(dimension.id, dto);
  }

  /** Bulk member import spanning multiple dimensions — each row's "dimension" column selects its target dimension. */
  bulkCreateMembersAcrossDimensions(
    tenantId: string,
    periodId: string,
    rows: Record<string, unknown>[],
  ): Promise<ImportResult> {
    return bulkImport(CreateDimensionMemberImportDto, rows, (dto) =>
      this.upsertMemberAcrossDimensions(tenantId, periodId, dto),
    );
  }
}
