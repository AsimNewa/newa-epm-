import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BulkImportRowsDto, CreateCustomFieldDefinitionDto, UpdateCustomFieldDefinitionDto } from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CustomFieldsService } from './custom-fields.service';

@Controller('custom-field-definitions')
@UseGuards(TenantGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @Query('entityType') entityType?: string) {
    return this.customFieldsService.findAll(tenantId, entityType);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateCustomFieldDefinitionDto) {
    return this.customFieldsService.create(tenantId, dto);
  }

  @Post('import')
  bulkImport(@TenantId() tenantId: string, @Body() dto: BulkImportRowsDto) {
    return this.customFieldsService.bulkCreate(tenantId, dto.rows);
  }

  @Put(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateCustomFieldDefinitionDto) {
    return this.customFieldsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.customFieldsService.remove(tenantId, id);
  }
}
