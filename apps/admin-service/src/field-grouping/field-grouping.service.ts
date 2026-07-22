import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertFieldGroupingDto {
  entityType: string;
  fieldKey: string;
  isGrouping: boolean;
  displayOrder?: number;
}

@Injectable()
export class FieldGroupingService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, entityType: string) {
    return this.prisma.fieldGroupingConfig.findMany({
      where: { tenantId, entityType },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async upsert(tenantId: string, dto: UpsertFieldGroupingDto) {
    return this.prisma.fieldGroupingConfig.upsert({
      where: { tenantId_entityType_fieldKey: { tenantId, entityType: dto.entityType, fieldKey: dto.fieldKey } },
      create: { tenantId, entityType: dto.entityType, fieldKey: dto.fieldKey, isGrouping: dto.isGrouping, displayOrder: dto.displayOrder ?? 0 },
      update: { isGrouping: dto.isGrouping, displayOrder: dto.displayOrder },
    });
  }
}
