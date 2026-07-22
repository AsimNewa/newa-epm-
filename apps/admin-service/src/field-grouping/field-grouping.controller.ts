import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { FieldGroupingService } from './field-grouping.service';

class UpsertGroupingDto {
  @IsString()
  entityType: string;

  @IsString()
  fieldKey: string;

  @IsBoolean()
  isGrouping: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

@Controller('field-grouping-configs')
@UseGuards(TenantGuard)
export class FieldGroupingController {
  constructor(private readonly fieldGroupingService: FieldGroupingService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @Query('entityType') entityType: string) {
    return this.fieldGroupingService.findAll(tenantId, entityType ?? 'ENTITY');
  }

  @Put()
  upsert(@TenantId() tenantId: string, @Body() dto: UpsertGroupingDto) {
    return this.fieldGroupingService.upsert(tenantId, dto);
  }
}
