import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateChartOfAccountDto, ImportResult, UpdateChartOfAccountDto } from '@newa-epm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';
import { bulkImport } from '../../common/bulk-import.util';

/** Fields from the DTO that can change (used in both create and update paths). */
function coaFields(dto: CreateChartOfAccountDto) {
  return {
    accountCode: dto.accountCode,
    accountName: dto.accountName,
    accountType: dto.accountType,
    accountNature: dto.accountNature,
    parentCode: dto.parentCode,
    rollupWeight: dto.rollupWeight ?? 1,
    statementType: dto.statementType,
    cashFlowCategory: dto.cashFlowCategory,
    ifrsReference: dto.ifrsReference,
    requiresIntercompanyRecon: dto.requiresIntercompanyRecon ?? false,
    requiresOtherRecon: dto.requiresOtherRecon ?? false,
    rateType: dto.rateType ?? null,
    customFields: dto.customFields as Prisma.InputJsonValue | undefined,
  };
}

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFields: CustomFieldsService,
  ) {}

  findAll(tenantId: string, periodId: string) {
    return this.prisma.chartOfAccount.findMany({
      where: { tenantId, periodId },
      orderBy: { accountCode: 'asc' },
    });
  }

  async findOne(tenantId: string, periodId: string, id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({ where: { id, tenantId, periodId } });

    if (!account) {
      throw new NotFoundException(`Chart of account ${id} not found`);
    }

    return account;
  }

  private async assertParentExists(tenantId: string, periodId: string, parentCode?: string): Promise<void> {
    if (!parentCode) {
      return;
    }

    const parent = await this.prisma.chartOfAccount.findUnique({
      where: { tenantId_periodId_accountCode: { tenantId, periodId, accountCode: parentCode } },
    });

    if (!parent) {
      throw new BadRequestException(`Parent account ${parentCode} does not exist`);
    }
  }

  async create(tenantId: string, periodId: string, dto: CreateChartOfAccountDto) {
    await this.assertParentExists(tenantId, periodId, dto.parentCode);
    await this.customFields.assertValid(tenantId, 'CHART_OF_ACCOUNT', dto.customFields);

    return this.prisma.chartOfAccount.create({
      data: { tenantId, periodId, ...coaFields(dto) },
    });
  }

  async update(tenantId: string, periodId: string, id: string, dto: UpdateChartOfAccountDto) {
    await this.findOne(tenantId, periodId, id);
    await this.assertParentExists(tenantId, periodId, dto.parentCode);

    if (dto.customFields) {
      await this.customFields.assertValid(tenantId, 'CHART_OF_ACCOUNT', dto.customFields);
    }

    return this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...dto,
        customFields: dto.customFields as Prisma.InputJsonValue | undefined,
      } as Prisma.ChartOfAccountUncheckedUpdateInput,
    });
  }

  async remove(tenantId: string, periodId: string, id: string): Promise<void> {
    await this.findOne(tenantId, periodId, id);
    await this.prisma.chartOfAccount.delete({ where: { id } });
  }

  async upsert(tenantId: string, periodId: string, dto: CreateChartOfAccountDto) {
    await this.assertParentExists(tenantId, periodId, dto.parentCode);
    await this.customFields.assertValid(tenantId, 'CHART_OF_ACCOUNT', dto.customFields);

    const allFields = coaFields(dto);
    const { accountCode: _code, ...updateData } = allFields;

    return this.prisma.chartOfAccount.upsert({
      where: { tenantId_periodId_accountCode: { tenantId, periodId, accountCode: dto.accountCode } },
      create: { tenantId, periodId, ...allFields },
      update: updateData,
    });
  }

  bulkCreate(tenantId: string, periodId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateChartOfAccountDto, rows, (dto) => this.upsert(tenantId, periodId, dto));
  }
}
