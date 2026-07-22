import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UpdateTenantSettingsDto } from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(TenantGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@TenantId() tenantId: string) {
    return this.settingsService.get(tenantId);
  }

  @Put()
  update(@TenantId() tenantId: string, @Body() dto: UpdateTenantSettingsDto) {
    return this.settingsService.update(tenantId, dto);
  }
}
