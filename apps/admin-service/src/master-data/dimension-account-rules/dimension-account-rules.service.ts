import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateDimensionAccountRuleDto,
  DimensionAccountResolution,
  DimensionRuleConditionInput,
  DimensionRuleContextEntry,
  ImportResult,
  UpdateDimensionAccountRuleDto,
} from '@newa-epm/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { accountMatchesRange, combinedSpecificity, isValidAccountRangeExpr } from '../../common/account-range.util';
import { bulkImport } from '../../common/bulk-import.util';

// Chart of Accounts axis, keyed as a Map key alongside real dimension ids (which are UUIDs and can
// never collide with this literal).
const COA_AXIS = '__CHART_OF_ACCOUNTS__';

@Injectable()
export class DimensionAccountRulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, periodId: string, dimensionId?: string) {
    return this.prisma.dimensionAccountRule.findMany({
      where: { tenantId, periodId, ...(dimensionId ? { dimensionId } : {}) },
      include: { conditions: true },
      orderBy: [{ dimensionId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(tenantId: string, periodId: string, id: string) {
    const rule = await this.prisma.dimensionAccountRule.findFirst({
      where: { id, tenantId, periodId },
      include: { conditions: true },
    });

    if (!rule) {
      throw new NotFoundException(`Dimension account rule ${id} not found`);
    }

    return rule;
  }

  private async assertDimensionExists(tenantId: string, periodId: string, dimensionId: string): Promise<void> {
    const dimension = await this.prisma.dimension.findFirst({ where: { id: dimensionId, tenantId, periodId } });

    if (!dimension) {
      throw new NotFoundException(`Dimension ${dimensionId} not found`);
    }
  }

  private assertValidRange(label: string, range: string): void {
    if (!isValidAccountRangeExpr(range)) {
      throw new BadRequestException(
        `"${range}" is not a valid ${label}. Use a single code ("12100"), an inclusive range ("11100..11999"), or a comma-separated list of either ("11100..11999,12100").`,
      );
    }
  }

  /**
   * Validates a rule's ANDed conditions: at least one, each with a syntactically valid range, no two
   * conditions keyed off the same source axis (ambiguous — use one range expression instead), and no
   * condition whose source dimension is the rule's own target (a dimension can't source itself).
   */
  private async validateConditions(
    tenantId: string,
    periodId: string,
    targetDimensionId: string,
    conditions: DimensionRuleConditionInput[] | undefined,
    { requireProvided }: { requireProvided: boolean },
  ): Promise<void> {
    if (conditions === undefined) {
      if (requireProvided) {
        throw new BadRequestException('At least one condition is required.');
      }
      return;
    }

    if (conditions.length === 0) {
      throw new BadRequestException('At least one condition is required.');
    }

    const seenAxes = new Set<string>();

    for (const condition of conditions) {
      const axisKey = condition.sourceDimensionId ?? COA_AXIS;

      if (seenAxes.has(axisKey)) {
        throw new BadRequestException(
          'A rule cannot have two conditions on the same source dimension — combine them into one range expression instead.',
        );
      }
      seenAxes.add(axisKey);

      if (condition.sourceDimensionId) {
        if (condition.sourceDimensionId === targetDimensionId) {
          throw new BadRequestException('A dimension cannot be the source of a rule that targets itself.');
        }
        await this.assertDimensionExists(tenantId, periodId, condition.sourceDimensionId);
      }

      this.assertValidRange('source range', condition.sourceRange);
    }
  }

  private validateMemberRangeAndDefault(dto: { memberRange?: string | null; defaultMemberCode?: string | null }): void {
    if (dto.memberRange === undefined || dto.memberRange === null) {
      return;
    }

    this.assertValidRange('member range', dto.memberRange);

    if (dto.defaultMemberCode && !accountMatchesRange(dto.defaultMemberCode, dto.memberRange)) {
      throw new BadRequestException(
        `Default member "${dto.defaultMemberCode}" falls outside the allowed member range "${dto.memberRange}".`,
      );
    }
  }

  async create(tenantId: string, periodId: string, dto: CreateDimensionAccountRuleDto) {
    await this.assertDimensionExists(tenantId, periodId, dto.dimensionId);
    await this.validateConditions(tenantId, periodId, dto.dimensionId, dto.conditions, { requireProvided: true });
    this.validateMemberRangeAndDefault(dto);

    return this.prisma.dimensionAccountRule.create({
      data: {
        tenantId,
        periodId,
        dimensionId: dto.dimensionId,
        applicability: dto.applicability,
        memberRange: dto.memberRange,
        defaultMemberCode: dto.defaultMemberCode,
        priority: dto.priority ?? 0,
        conditions: {
          create: dto.conditions.map((c) => ({ sourceDimensionId: c.sourceDimensionId, sourceRange: c.sourceRange })),
        },
      },
      include: { conditions: true },
    });
  }

  async update(tenantId: string, periodId: string, id: string, dto: UpdateDimensionAccountRuleDto) {
    const existing = await this.findOne(tenantId, periodId, id);
    await this.validateConditions(tenantId, periodId, existing.dimensionId, dto.conditions, { requireProvided: false });
    this.validateMemberRangeAndDefault(dto);

    return this.prisma.dimensionAccountRule.update({
      where: { id },
      data: {
        applicability: dto.applicability,
        memberRange: dto.memberRange,
        defaultMemberCode: dto.defaultMemberCode,
        priority: dto.priority,
        ...(dto.conditions !== undefined
          ? {
              conditions: {
                deleteMany: {},
                create: dto.conditions.map((c) => ({ sourceDimensionId: c.sourceDimensionId, sourceRange: c.sourceRange })),
              },
            }
          : {}),
      },
      include: { conditions: true },
    });
  }

  async remove(tenantId: string, periodId: string, id: string): Promise<void> {
    await this.findOne(tenantId, periodId, id);
    await this.prisma.dimensionAccountRule.delete({ where: { id } });
  }

  /** Bulk import, scoped to one target dimension — each row supplies applicability/memberRange/defaultMemberCode/priority/conditions. */
  bulkCreate(
    tenantId: string,
    periodId: string,
    dimensionId: string,
    rows: Record<string, unknown>[],
  ): Promise<ImportResult> {
    const rowsWithDimension = rows.map((row) => ({ ...row, dimensionId }));
    return bulkImport(CreateDimensionAccountRuleDto, rowsWithDimension, (dto) => this.create(tenantId, periodId, dto));
  }

  /**
   * Resolves a target dimension's applicability/default given a set of known (source axis, code)
   * facts — a rule matches only when EVERY one of its conditions is satisfied by some fact in the
   * context (AND). Among matching rules, the most specific wins: smallest combined range size
   * (narrower ranges and more conditions both narrow the match set), ties broken by priority then
   * most-recently-created. If nothing matches, system dimensions (e.g. FlowCode) default to
   * MANDATORY, regular dimensions to OPTIONAL.
   */
  async resolve(
    tenantId: string,
    periodId: string,
    dimensionId: string,
    context: DimensionRuleContextEntry[],
  ): Promise<DimensionAccountResolution> {
    const dimension = await this.prisma.dimension.findFirst({ where: { id: dimensionId, tenantId, periodId } });

    if (!dimension) {
      throw new NotFoundException(`Dimension ${dimensionId} not found`);
    }

    const rules = await this.prisma.dimensionAccountRule.findMany({
      where: { tenantId, periodId, dimensionId },
      include: { conditions: true },
    });

    const codeByAxis = new Map<string, string>();
    for (const entry of context) {
      codeByAxis.set(entry.sourceDimensionId ?? COA_AXIS, entry.code);
    }

    const matches = rules.filter(
      (rule) =>
        rule.conditions.length > 0 &&
        rule.conditions.every((condition) => {
          const code = codeByAxis.get(condition.sourceDimensionId ?? COA_AXIS);
          return code !== undefined && accountMatchesRange(code, condition.sourceRange);
        }),
    );

    if (matches.length === 0) {
      return {
        dimensionId,
        applicability: dimension.isSystem ? 'MANDATORY' : 'OPTIONAL',
        memberRange: null,
        defaultMemberCode: null,
        matchedRuleId: null,
      };
    }

    const best = matches.sort((a, b) => {
      const specificityDiff =
        combinedSpecificity(a.conditions.map((c) => c.sourceRange)) - combinedSpecificity(b.conditions.map((c) => c.sourceRange));
      if (specificityDiff !== 0) return specificityDiff;
      if (a.conditions.length !== b.conditions.length) return b.conditions.length - a.conditions.length;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0];

    return {
      dimensionId,
      applicability: best.applicability as DimensionAccountResolution['applicability'],
      memberRange: best.memberRange,
      defaultMemberCode: best.defaultMemberCode,
      matchedRuleId: best.id,
    };
  }

  /** Resolves every dimension in this period against a shared context of known (axis, code) facts. */
  async resolveAllDimensions(
    tenantId: string,
    periodId: string,
    context: DimensionRuleContextEntry[],
  ): Promise<DimensionAccountResolution[]> {
    const dimensions = await this.prisma.dimension.findMany({ where: { tenantId, periodId } });
    return Promise.all(dimensions.map((dim) => this.resolve(tenantId, periodId, dim.id, context)));
  }

  /** Convenience wrapper: resolves every dimension against a single Chart-of-Accounts code. */
  resolveAllDimensionsForAccount(tenantId: string, periodId: string, accountCode: string): Promise<DimensionAccountResolution[]> {
    return this.resolveAllDimensions(tenantId, periodId, [{ sourceDimensionId: undefined, code: accountCode }]);
  }
}
