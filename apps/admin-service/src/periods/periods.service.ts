import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CopyMasterDataDto,
  CreateFiscalYearDto,
  CreatePeriodDto,
  ImportResult,
  UpdatePeriodDto,
} from '@newa-epm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { addMonths, firstDayOfMonthUTC, lastDayOfMonthUTC, monthName } from './period-date.util';
import { bulkImport } from '../common/bulk-import.util';

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllFiscalYears(tenantId: string) {
    return this.prisma.fiscalYear.findMany({
      where: { tenantId },
      include: { periods: { orderBy: { startDate: 'asc' } } },
      orderBy: { startYear: 'desc' },
    });
  }

  findAllPeriods(tenantId: string) {
    return this.prisma.period.findMany({
      where: { tenantId },
      orderBy: { startDate: 'asc' },
    });
  }

  async findPeriod(tenantId: string, id: string) {
    const period = await this.prisma.period.findFirst({ where: { id, tenantId } });

    if (!period) {
      throw new NotFoundException(`Period ${id} not found`);
    }

    return period;
  }

  private async findMostRecentPeriodBefore(tenantId: string, date: Date) {
    return this.prisma.period.findFirst({
      where: { tenantId, endDate: { lt: date } },
      orderBy: { endDate: 'desc' },
    });
  }

  private async nextPeriodNumberForYear(tenantId: string, year: number): Promise<string> {
    const count = await this.prisma.period.count({ where: { tenantId, period: { startsWith: `${year}-` } } });
    return String(count + 1).padStart(3, '0');
  }

  async createFiscalYear(tenantId: string, dto: CreateFiscalYearDto) {
    const regularPeriods = dto.regularPeriods ?? 12;
    const adjustmentPeriods = dto.adjustmentPeriods ?? 0;
    const totalPeriods = regularPeriods + adjustmentPeriods;

    const fiscalYear = await this.prisma.fiscalYear.create({
      data: {
        tenantId,
        startYear: dto.startYear,
        startMonth: dto.startMonth,
        regularPeriods,
        adjustmentPeriods,
      },
    });

    const firstPeriodStart = firstDayOfMonthUTC(dto.startYear, dto.startMonth);
    const priorPeriod = await this.findMostRecentPeriodBefore(tenantId, firstPeriodStart);

    let previousPeriodId = priorPeriod?.id;
    let yearEndDate = firstPeriodStart;
    let cursor = { year: dto.startYear, month: dto.startMonth };

    for (let i = 1; i <= totalPeriods; i++) {
      const isAdjustment = i > regularPeriods;
      const periodNumber = String(i).padStart(3, '0');
      const code = `${dto.startYear}-${periodNumber}`;

      let startDate: Date;
      let endDate: Date;
      let name: string;

      if (!isAdjustment) {
        startDate = firstDayOfMonthUTC(cursor.year, cursor.month);
        endDate = lastDayOfMonthUTC(cursor.year, cursor.month);
        name = `${monthName(cursor.month)} ${cursor.year}`;
        yearEndDate = endDate;
        cursor = addMonths(cursor.year, cursor.month, 1);
      } else {
        startDate = yearEndDate;
        endDate = yearEndDate;
        name = `Adjustment ${i - regularPeriods}`;
      }

      const created = await this.prisma.period.create({
        data: {
          tenantId,
          fiscalYearId: fiscalYear.id,
          name,
          period: code,
          periodNumber,
          isAdjustment,
          startDate,
          endDate,
          openingBalanceSourcePeriodId: previousPeriodId,
        },
      });

      previousPeriodId = created.id;
    }

    return this.prisma.fiscalYear.findUniqueOrThrow({
      where: { id: fiscalYear.id },
      include: { periods: { orderBy: { startDate: 'asc' } } },
    });
  }

  async createPeriod(tenantId: string, dto: CreatePeriodDto) {
    const startDate = new Date(dto.startDate);
    const year = startDate.getUTCFullYear();
    const periodNumber = dto.periodNumber ?? (await this.nextPeriodNumberForYear(tenantId, year));
    const code = dto.period ?? `${year}-${periodNumber}`;

    const openingBalanceSourcePeriodId =
      dto.openingBalanceSourcePeriodId ?? (await this.findMostRecentPeriodBefore(tenantId, startDate))?.id;

    return this.prisma.period.create({
      data: {
        tenantId,
        name: dto.name,
        period: code,
        periodNumber,
        isAdjustment: dto.isAdjustment ?? false,
        startDate,
        endDate: new Date(dto.endDate),
        openingBalanceSourcePeriodId,
      },
    });
  }

  /** Bulk-import counterpart to createPeriod — requires/derives a stable period code so re-imports upsert in place. */
  async upsertPeriod(tenantId: string, dto: CreatePeriodDto) {
    const startDate = new Date(dto.startDate);
    const year = startDate.getUTCFullYear();
    const periodNumber = dto.periodNumber ?? (await this.nextPeriodNumberForYear(tenantId, year));
    const code = dto.period ?? `${year}-${periodNumber}`;

    const openingBalanceSourcePeriodId =
      dto.openingBalanceSourcePeriodId ?? (await this.findMostRecentPeriodBefore(tenantId, startDate))?.id;

    return this.prisma.period.upsert({
      where: { tenantId_period: { tenantId, period: code } },
      create: {
        tenantId,
        name: dto.name,
        period: code,
        periodNumber,
        isAdjustment: dto.isAdjustment ?? false,
        startDate,
        endDate: new Date(dto.endDate),
        openingBalanceSourcePeriodId,
      },
      update: {
        name: dto.name,
        periodNumber,
        isAdjustment: dto.isAdjustment ?? false,
        startDate,
        endDate: new Date(dto.endDate),
      },
    });
  }

  bulkCreatePeriods(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreatePeriodDto, rows, (dto) => this.upsertPeriod(tenantId, dto));
  }

  async updatePeriod(tenantId: string, id: string, dto: UpdatePeriodDto) {
    await this.findPeriod(tenantId, id);

    return this.prisma.period.update({ where: { id }, data: dto });
  }

  async removePeriod(tenantId: string, id: string): Promise<void> {
    await this.findPeriod(tenantId, id);
    await this.prisma.period.delete({ where: { id } });
  }

  async copyMasterData(tenantId: string, targetPeriodId: string, dto: CopyMasterDataDto) {
    const target = await this.findPeriod(tenantId, targetPeriodId);
    const source = await this.findPeriod(tenantId, dto.sourcePeriodId);

    if (source.id === target.id) {
      throw new BadRequestException('Source and target period must be different');
    }

    return this.prisma.$transaction(async (tx) => {
      // Entities
      const sourceEntities = await tx.entity.findMany({ where: { tenantId, periodId: source.id } });
      const entityIdMap = new Map<string, string>();

      for (const entity of sourceEntities) {
        const created = await tx.entity.create({
          data: {
            tenantId,
            periodId: target.id,
            code: entity.code,
            name: entity.name,
            country: entity.country,
            currency: entity.currency,
            status: entity.status,
          },
        });
        entityIdMap.set(entity.id, created.id);
      }

      // Chart of accounts (parentCode is code-based, so no id remapping needed)
      const sourceAccounts = await tx.chartOfAccount.findMany({ where: { tenantId, periodId: source.id } });

      for (const account of sourceAccounts) {
        await tx.chartOfAccount.create({
          data: {
            tenantId,
            periodId: target.id,
            accountCode: account.accountCode,
            accountName: account.accountName,
            accountType: account.accountType,
            accountNature: account.accountNature,
            parentCode: account.parentCode,
            rollupWeight: account.rollupWeight,
            status: account.status,
          },
        });
      }

      // Dimensions + members
      const sourceDimensions = await tx.dimension.findMany({
        where: { tenantId, periodId: source.id },
        include: { members: true },
      });

      for (const dimension of sourceDimensions) {
        const createdDimension = await tx.dimension.create({
          data: { tenantId, periodId: target.id, name: dimension.name, type: dimension.type, status: dimension.status },
        });

        // parentCode is code-based, so no id remapping needed (see ChartOfAccount above)
        for (const member of dimension.members) {
          await tx.dimensionMember.create({
            data: {
              dimensionId: createdDimension.id,
              code: member.code,
              name: member.name,
              parentCode: member.parentCode,
              weight: member.weight,
              status: member.status,
            },
          });
        }
      }

      // Consolidation groups + members + ownership periods
      const sourceGroups = await tx.consolidationGroup.findMany({
        where: { tenantId, periodId: source.id },
        include: { members: true, ownershipPeriods: true },
      });

      for (const group of sourceGroups) {
        const createdGroup = await tx.consolidationGroup.create({
          data: {
            tenantId,
            periodId: target.id,
            code: group.code,
            name: group.name,
            reportingCurrency: group.reportingCurrency,
            parentEntityId: group.parentEntityId ? entityIdMap.get(group.parentEntityId) : undefined,
            status: group.status,
          },
        });

        for (const member of group.members) {
          await tx.groupEntity.create({
            data: {
              groupId: createdGroup.id,
              entityId: entityIdMap.get(member.entityId) ?? member.entityId,
              consolidationMethod: member.consolidationMethod,
              effectiveFrom: member.effectiveFrom,
              effectiveTo: member.effectiveTo,
            },
          });
        }

        for (const ownership of group.ownershipPeriods) {
          await tx.ownershipPeriod.create({
            data: {
              tenantId,
              groupId: createdGroup.id,
              parentEntityId: entityIdMap.get(ownership.parentEntityId) ?? ownership.parentEntityId,
              subsidiaryEntityId: entityIdMap.get(ownership.subsidiaryEntityId) ?? ownership.subsidiaryEntityId,
              directPercentage: ownership.directPercentage,
              effectivePercentage: ownership.effectivePercentage,
              nciPercentage: ownership.nciPercentage,
              // effectiveFrom/ToPeriodId reference the actual fiscal periods the stake applies to —
              // these are historical facts independent of which period's master data is being copied,
              // so they are carried over unchanged rather than remapped.
              effectiveFromPeriodId: ownership.effectiveFromPeriodId,
              effectiveToPeriodId: ownership.effectiveToPeriodId,
              acquisitionCost: ownership.acquisitionCost,
              acquisitionDate: ownership.acquisitionDate,
            },
          });
        }
      }

      await tx.period.update({ where: { id: target.id }, data: { copiedFromPeriodId: source.id } });

      return tx.period.findUniqueOrThrow({ where: { id: target.id } });
    });
  }
}
