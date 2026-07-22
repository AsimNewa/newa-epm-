import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UpdateThemeDto } from '@newa-epm/shared';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ThemeService } from './theme.service';

@Controller('theme')
@UseGuards(TenantGuard)
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get()
  get(@TenantId() tenantId: string) {
    return this.themeService.get(tenantId);
  }

  @Put()
  update(@TenantId() tenantId: string, @Body() dto: UpdateThemeDto) {
    return this.themeService.update(tenantId, dto);
  }
}
