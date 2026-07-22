import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AssignUserRoleDto, CreateUserDto, UpdateUserDto } from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.usersService.findOne(tenantId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(tenantId, dto);
  }

  @Put(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @Param('id') id: string): Promise<void> {
    return this.usersService.remove(tenantId, id);
  }

  @Post(':id/roles')
  assignRole(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: AssignUserRoleDto) {
    return this.usersService.assignRole(tenantId, id, dto);
  }

  @Delete(':id/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRole(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    return this.usersService.removeRole(tenantId, id, roleId);
  }
}
