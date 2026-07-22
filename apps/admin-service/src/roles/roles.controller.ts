import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BulkImportRowsDto, CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';

@Controller()
@UseGuards(TenantGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('permissions')
  findAllPermissions() {
    return this.permissionsService.findAll();
  }

  @Get('roles')
  findAll(@TenantId() tenantId: string) {
    return this.rolesService.findAll(tenantId);
  }

  @Get('roles/:id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.rolesService.findOne(tenantId, id);
  }

  @Post('roles')
  create(@TenantId() tenantId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(tenantId, dto);
  }

  @Post('roles/import')
  bulkImport(@TenantId() tenantId: string, @Body() dto: BulkImportRowsDto) {
    return this.rolesService.bulkCreate(tenantId, dto.rows);
  }

  @Put('roles/:id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(tenantId, id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.rolesService.remove(tenantId, id);
  }

  @Put('roles/:id/permissions')
  setPermissions(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    return this.rolesService.setPermissions(tenantId, id, dto);
  }
}
