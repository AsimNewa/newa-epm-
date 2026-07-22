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
import { BulkImportRowsDto, CreateEntityDto, UpdateEntityDto } from '@newa-epm/shared';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PeriodGuard } from '../../common/guards/period.guard';
import { UserContextGuard } from '../../common/guards/user-context.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PeriodId } from '../../common/decorators/period-id.decorator';
import { EntitiesService } from './entities.service';

type ScopedReq = Request & { entityScope?: string[] | null };

@Controller('entities')
@UseGuards(TenantGuard, UserContextGuard, PeriodGuard)
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  async findAll(@TenantId() tenantId: string, @PeriodId() periodId: string, @Req() req: ScopedReq) {
    const entities = await this.entitiesService.findAll(tenantId, periodId);
    const scope = req.entityScope ?? null;
    return scope !== null ? entities.filter((e) => scope.includes(e.id)) : entities;
  }

  @Post('import')
  bulkImport(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: BulkImportRowsDto) {
    return this.entitiesService.bulkCreate(tenantId, periodId, dto.rows);
  }

  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Req() req: ScopedReq,
  ) {
    const entity = await this.entitiesService.findOne(tenantId, periodId, id);
    const scope = req.entityScope ?? null;

    if (scope !== null && !scope.includes(entity.id)) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    return entity;
  }

  @Post()
  create(@TenantId() tenantId: string, @PeriodId() periodId: string, @Body() dto: CreateEntityDto) {
    return this.entitiesService.create(tenantId, periodId, dto);
  }

  @Put(':id')
  update(
    @TenantId() tenantId: string,
    @PeriodId() periodId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEntityDto,
  ) {
    return this.entitiesService.update(tenantId, periodId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @PeriodId() periodId: string, @Param('id') id: string): Promise<void> {
    return this.entitiesService.remove(tenantId, periodId, id);
  }
}
