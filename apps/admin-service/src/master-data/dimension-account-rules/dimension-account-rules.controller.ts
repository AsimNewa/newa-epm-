import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  BulkImportRowsDto,
  CreateDimensionAccountRuleDto,
  ResolveAllDimensionRulesDto,
  ResolveDimensionRuleDto,
  UpdateDimensionAccountRuleDto,
} from '@newa-epm/shared';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PeriodGuard } from '../../common/guards/period.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PeriodId } from '../../common/decorators/period-id.decorator';
import { DimensionAccountRulesService } from './dimension-account-rules.service';

@Controller('dimension-account-rules')
@UseGuards(TenantGuard, PeriodGuard)
export class DimensionAccountRulesController {
  constructor(private readonly rulesService: DimensionAccountRulesService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @PeriodId() periodId: string, @Query('dimensionId') dimensionId?: string) {
    return this.rulesService.findAll(tenantId, periodId, dimensionId);
  }

  // POST (not GET) because a resolve context can carry an arbitrary number of source facts.
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: ResolveDimensionRuleDto) {
    return this.rulesService.resolve(tenantId, periodId, dto.dimensionId, dto.context);
  }

  @Post('resolve-all')
  @HttpCode(HttpStatus.OK)
  resolveAllDimensions(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: ResolveAllDimensionRulesDto) {
    return this.rulesService.resolveAllDimensions(tenantId, periodId, dto.context);
  }

  @Get('resolve-account/:accountCode')
  resolveAllDimensionsForAccount(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('accountCode') accountCode: string,
  ) {
    return this.rulesService.resolveAllDimensionsForAccount(tenantId, periodId, accountCode);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string) {
    return this.rulesService.findOne(tenantId, periodId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: CreateDimensionAccountRuleDto) {
    return this.rulesService.create(tenantId, periodId, dto);
  }

  @Post('import')
  bulkImport(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Query('dimensionId') dimensionId: string,
    @Body() dto: BulkImportRowsDto,
  ) {
    return this.rulesService.bulkCreate(tenantId, periodId, dimensionId, dto.rows);
  }

  @Put(':id')
  update(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDimensionAccountRuleDto,
  ) {
    return this.rulesService.update(tenantId, periodId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string): Promise<void> {
    return this.rulesService.remove(tenantId, periodId, id);
  }
}
