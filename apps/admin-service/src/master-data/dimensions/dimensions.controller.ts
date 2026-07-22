import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  BulkImportRowsDto,
  CreateDimensionDto,
  CreateDimensionMemberDto,
  UpdateDimensionDto,
  UpdateDimensionMemberDto,
} from '@newa-epm/shared';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PeriodGuard } from '../../common/guards/period.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PeriodId } from '../../common/decorators/period-id.decorator';
import { DimensionsService } from './dimensions.service';

@Controller('dimensions')
@UseGuards(TenantGuard, PeriodGuard)
export class DimensionsController {
  constructor(private readonly dimensionsService: DimensionsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @PeriodId() periodId: string) {
    return this.dimensionsService.findAll(tenantId, periodId);
  }

  @Post('import')
  bulkImport(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: BulkImportRowsDto) {
    return this.dimensionsService.bulkCreate(tenantId, periodId, dto.rows);
  }

  // Member import spans dimensions — each row's "dimension" column selects its own target dimension.
  @Post('members/import')
  bulkImportMembers(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: BulkImportRowsDto) {
    return this.dimensionsService.bulkCreateMembersAcrossDimensions(tenantId, periodId, dto.rows);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string) {
    return this.dimensionsService.findOne(tenantId, periodId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: CreateDimensionDto) {
    return this.dimensionsService.create(tenantId, periodId, dto);
  }

  @Put(':id')
  update(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDimensionDto,
  ) {
    return this.dimensionsService.update(tenantId, periodId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string): Promise<void> {
    return this.dimensionsService.remove(tenantId, periodId, id);
  }

  @Get(':id/members')
  findAllMembers(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') dimensionId: string) {
    return this.dimensionsService.findOne(tenantId, periodId, dimensionId).then((dimension) => dimension.members);
  }

  @Get(':id/members/:memberId')
  findOneMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') dimensionId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.dimensionsService.findMember(tenantId, periodId, dimensionId, memberId);
  }

  @Post(':id/members')
  createMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') dimensionId: string,
    @Body() dto: CreateDimensionMemberDto,
  ) {
    return this.dimensionsService.createMember(tenantId, periodId, dimensionId, dto);
  }

  @Put(':id/members/:memberId')
  updateMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') dimensionId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateDimensionMemberDto,
  ) {
    return this.dimensionsService.updateMember(tenantId, periodId, dimensionId, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') dimensionId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    return this.dimensionsService.removeMember(tenantId, periodId, dimensionId, memberId);
  }
}
