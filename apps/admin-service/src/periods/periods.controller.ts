import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  BulkImportRowsDto,
  CopyMasterDataDto,
  CreateFiscalYearDto,
  CreatePeriodDto,
  UpdatePeriodDto,
} from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PeriodsService } from './periods.service';

@Controller()
@UseGuards(TenantGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get('fiscal-years')
  findAllFiscalYears(@TenantId() tenantId: string) {
    return this.periodsService.findAllFiscalYears(tenantId);
  }

  @Post('fiscal-years')
  createFiscalYear(@TenantId() tenantId: string, @Body() dto: CreateFiscalYearDto) {
    return this.periodsService.createFiscalYear(tenantId, dto);
  }

  @Get('periods')
  findAllPeriods(@TenantId() tenantId: string) {
    return this.periodsService.findAllPeriods(tenantId);
  }

  @Get('periods/:id')
  findPeriod(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.periodsService.findPeriod(tenantId, id);
  }

  @Post('periods')
  createPeriod(@TenantId() tenantId: string, @Body() dto: CreatePeriodDto) {
    return this.periodsService.createPeriod(tenantId, dto);
  }

  @Post('periods/import')
  bulkImportPeriods(@TenantId() tenantId: string, @Body() dto: BulkImportRowsDto) {
    return this.periodsService.bulkCreatePeriods(tenantId, dto.rows);
  }

  @Put('periods/:id')
  updatePeriod(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdatePeriodDto) {
    return this.periodsService.updatePeriod(tenantId, id, dto);
  }

  @Delete('periods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePeriod(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.periodsService.removePeriod(tenantId, id);
  }

  @Post('periods/:id/copy-master-data')
  copyMasterData(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: CopyMasterDataDto) {
    return this.periodsService.copyMasterData(tenantId, id, dto);
  }
}
