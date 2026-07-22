import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRateTypeDto, ImportResult, UpdateRateTypeDto } from '@newa-epm/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { bulkImport } from '../../common/bulk-import.util';

@Injectable()
export class RateTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.rateType.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const rateType = await this.prisma.rateType.findFirst({ where: { id, tenantId } });
    if (!rateType) throw new NotFoundException(`Rate type ${id} not found`);
    return rateType;
  }

  create(tenantId: string, dto: CreateRateTypeDto) {
    return this.prisma.rateType.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        defaultAccountTypes: dto.defaultAccountTypes ?? [],
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateRateTypeDto) {
    await this.findOne(tenantId, id);
    return this.prisma.rateType.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        defaultAccountTypes: dto.defaultAccountTypes,
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOne(tenantId, id);
    await this.prisma.rateType.delete({ where: { id } });
  }

  async upsert(tenantId: string, dto: CreateRateTypeDto) {
    return this.prisma.rateType.upsert({
      where: { tenantId_code: { tenantId, code: dto.code } },
      create: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        defaultAccountTypes: dto.defaultAccountTypes ?? [],
      },
      update: {
        name: dto.name,
        description: dto.description,
        defaultAccountTypes: dto.defaultAccountTypes ?? [],
      },
    });
  }

  bulkCreate(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateRateTypeDto, rows, (dto) => this.upsert(tenantId, dto));
  }
}
