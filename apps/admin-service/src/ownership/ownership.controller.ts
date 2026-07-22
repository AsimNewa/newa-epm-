import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  BulkImportRowsDto,
  CreateConsolidationGroupDto,
  CreateGroupMemberDto,
  CreateOwnershipPeriodDto,
  CreateOwnershipStructureEntryDto,
  UpdateConsolidationGroupDto,
  UpdateGroupMemberDto,
  UpdateOwnershipPeriodDto,
  UpdateOwnershipStructureEntryDto,
} from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PeriodGuard } from '../common/guards/period.guard';
import { UserContextGuard } from '../common/guards/user-context.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PeriodId } from '../common/decorators/period-id.decorator';
import { OwnershipService } from './ownership.service';

type ScopedReq = Request & { groupScope?: string[] | null };

@Controller('consolidation-groups')
@UseGuards(TenantGuard, UserContextGuard, PeriodGuard)
export class OwnershipController {
  constructor(private readonly ownershipService: OwnershipService) {}

  @Get()
  async findAllGroups(@TenantId() tenantId: string, @PeriodId() periodId: string, @Req() req: ScopedReq) {
    const groups = await this.ownershipService.findAllGroups(tenantId, periodId);
    const scope = req.groupScope ?? null;
    return scope !== null ? groups.filter((g) => scope.includes(g.id)) : groups;
  }

  @Post('import')
  bulkImportGroups(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: BulkImportRowsDto) {
    return this.ownershipService.bulkCreateGroups(tenantId, periodId, dto.rows);
  }

  @Get(':id')
  async findGroup(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Req() req: ScopedReq,
  ) {
    const group = await this.ownershipService.findGroup(tenantId, periodId, id);
    const scope = req.groupScope ?? null;

    if (scope !== null && !scope.includes(group.id)) {
      throw new ForbiddenException('You do not have access to this consolidation group');
    }

    return group;
  }

  @Post()
  createGroup(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: CreateConsolidationGroupDto) {
    return this.ownershipService.createGroup(tenantId, periodId, dto);
  }

  @Put(':id')
  updateGroup(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsolidationGroupDto,
  ) {
    return this.ownershipService.updateGroup(tenantId, periodId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGroup(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string): Promise<void> {
    return this.ownershipService.removeGroup(tenantId, periodId, id);
  }

  @Post(':id/members')
  createMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Body() dto: CreateGroupMemberDto,
  ) {
    return this.ownershipService.createMember(tenantId, periodId, groupId, dto);
  }

  @Put(':id/members/:memberId')
  updateMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateGroupMemberDto,
  ) {
    return this.ownershipService.updateMember(tenantId, periodId, groupId, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    return this.ownershipService.removeMember(tenantId, periodId, groupId, memberId);
  }

  @Get(':id/ownership-periods')
  findAllOwnershipPeriods(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') groupId: string) {
    return this.ownershipService.findAllOwnershipPeriods(tenantId, periodId, groupId);
  }

  @Post(':id/ownership-periods')
  createOwnershipPeriod(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Body() dto: CreateOwnershipPeriodDto,
  ) {
    return this.ownershipService.createOwnershipPeriod(tenantId, periodId, groupId, dto);
  }

  @Put(':id/ownership-periods/:periodId')
  updateOwnershipPeriod(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Param('periodId') ownershipPeriodId: string,
    @Body() dto: UpdateOwnershipPeriodDto,
  ) {
    return this.ownershipService.updateOwnershipPeriod(tenantId, periodId, groupId, ownershipPeriodId, dto);
  }

  @Delete(':id/ownership-periods/:periodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOwnershipPeriod(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Param('periodId') ownershipPeriodId: string,
  ): Promise<void> {
    return this.ownershipService.removeOwnershipPeriod(tenantId, periodId, groupId, ownershipPeriodId);
  }

  @Get(':id/ownership-structure')
  findAllOwnershipStructure(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') groupId: string) {
    return this.ownershipService.findAllOwnershipStructure(tenantId, periodId, groupId);
  }

  @Post(':id/ownership-structure')
  createOwnershipStructureEntry(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Body() dto: CreateOwnershipStructureEntryDto,
  ) {
    return this.ownershipService.createOwnershipStructureEntry(tenantId, periodId, groupId, dto);
  }

  @Put(':id/ownership-structure/:entryId')
  updateOwnershipStructureEntry(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateOwnershipStructureEntryDto,
  ) {
    return this.ownershipService.updateOwnershipStructureEntry(tenantId, periodId, groupId, entryId, dto);
  }

  @Delete(':id/ownership-structure/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOwnershipStructureEntry(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Param('entryId') entryId: string,
  ): Promise<void> {
    return this.ownershipService.removeOwnershipStructureEntry(tenantId, periodId, groupId, entryId);
  }

  @Post(':id/ownership-structure/import')
  bulkImportOwnershipStructure(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') groupId: string,
    @Body() dto: BulkImportRowsDto,
  ) {
    return this.ownershipService.bulkImportOwnershipStructure(tenantId, periodId, groupId, dto.rows);
  }
}
