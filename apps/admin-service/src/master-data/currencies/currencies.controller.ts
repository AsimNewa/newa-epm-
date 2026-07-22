import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  BulkImportRowsDto,
  CreateCurrencyDto,
  CreateExchangeRateDto,
  UpdateCurrencyDto,
  UpdateExchangeRateDto,
} from '@newa-epm/shared';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrenciesService } from './currencies.service';

@Controller()
@UseGuards(TenantGuard)
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get('currencies')
  findAll(@TenantId() tenantId: string) {
    return this.currenciesService.findAll(tenantId);
  }

  @Post('currencies/import')
  bulkImport(@TenantId() tenantId: string, @Body() dto: BulkImportRowsDto) {
    return this.currenciesService.bulkCreate(tenantId, dto.rows);
  }

  @Get('currencies/:id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.currenciesService.findOne(tenantId, id);
  }

  @Post('currencies')
  create(@TenantId() tenantId: string, @Body() dto: CreateCurrencyDto) {
    return this.currenciesService.create(tenantId, dto);
  }

  @Put('currencies/:id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCurrencyDto) {
    return this.currenciesService.update(tenantId, id, dto);
  }

  @Delete('currencies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.currenciesService.remove(tenantId, id);
  }

  @Get('exchange-rates')
  findAllExchangeRates(@TenantId() tenantId: string) {
    return this.currenciesService.findAllExchangeRates(tenantId);
  }

  @Post('exchange-rates/import')
  bulkImportExchangeRates(@TenantId() tenantId: string, @Body() dto: BulkImportRowsDto) {
    return this.currenciesService.bulkCreateExchangeRates(tenantId, dto.rows);
  }

  @Get('exchange-rates/:id')
  findOneExchangeRate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.currenciesService.findOneExchangeRate(tenantId, id);
  }

  @Post('exchange-rates')
  createExchangeRate(@TenantId() tenantId: string, @Body() dto: CreateExchangeRateDto) {
    return this.currenciesService.createExchangeRate(tenantId, dto);
  }

  @Put('exchange-rates/:id')
  updateExchangeRate(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateExchangeRateDto) {
    return this.currenciesService.updateExchangeRate(tenantId, id, dto);
  }

  @Delete('exchange-rates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExchangeRate(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.currenciesService.removeExchangeRate(tenantId, id);
  }
}
