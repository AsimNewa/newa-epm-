import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BulkImportRowsDto, CreateRateTypeDto, UpdateRateTypeDto } from '@newa-epm/shared';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { RateTypesService } from './rate-types.service';

@Controller('rate-types')
@UseGuards(TenantGuard)
export class RateTypesController {
  constructor(private readonly rateTypesService: RateTypesService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.rateTypesService.findAll(tenantId);
  }

  @Post('import')
  bulkImport(@TenantId() tenantId: string, @Body() dto: BulkImportRowsDto) {
    return this.rateTypesService.bulkCreate(tenantId, dto.rows);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.rateTypesService.findOne(tenantId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateRateTypeDto) {
    return this.rateTypesService.create(tenantId, dto);
  }

  @Put(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRateTypeDto) {
    return this.rateTypesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.rateTypesService.remove(tenantId, id);
  }
}
