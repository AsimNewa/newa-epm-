import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BulkImportRowsDto, CreateChartOfAccountDto, UpdateChartOfAccountDto } from '@newa-epm/shared';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PeriodGuard } from '../../common/guards/period.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PeriodId } from '../../common/decorators/period-id.decorator';
import { ChartOfAccountsService } from './chart-of-accounts.service';

@Controller('chart-of-accounts')
@UseGuards(TenantGuard, PeriodGuard)
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @PeriodId() periodId: string) {
    return this.chartOfAccountsService.findAll(tenantId, periodId);
  }

  @Post('import')
  bulkImport(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: BulkImportRowsDto) {
    return this.chartOfAccountsService.bulkCreate(tenantId, periodId, dto.rows);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string) {
    return this.chartOfAccountsService.findOne(tenantId, periodId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: CreateChartOfAccountDto) {
    return this.chartOfAccountsService.create(tenantId, periodId, dto);
  }

  @Put(':id')
  update(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChartOfAccountDto,
  ) {
    return this.chartOfAccountsService.update(tenantId, periodId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string): Promise<void> {
    return this.chartOfAccountsService.remove(tenantId, periodId, id);
  }
}
