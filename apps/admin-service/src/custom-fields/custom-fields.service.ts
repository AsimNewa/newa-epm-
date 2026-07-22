import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateCustomFieldDefinitionDto,
  CustomFieldEntityType,
  ImportResult,
  UpdateCustomFieldDefinitionDto,
} from '@newa-epm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { validateCustomFieldValues } from './validate-custom-fields.util';
import { bulkImport } from '../common/bulk-import.util';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, entityType?: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: { tenantId, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const definition = await this.prisma.customFieldDefinition.findFirst({ where: { id, tenantId } });

    if (!definition) {
      throw new NotFoundException(`Custom field definition ${id} not found`);
    }

    return definition;
  }

  create(tenantId: string, dto: CreateCustomFieldDefinitionDto) {
    if (dto.fieldType === 'SELECT' && (!dto.selectOptions || dto.selectOptions.length === 0)) {
      throw new BadRequestException('SELECT fields require at least one option');
    }

    return this.prisma.customFieldDefinition.create({
      data: {
        tenantId,
        entityType: dto.entityType,
        fieldKey: dto.fieldKey,
        label: dto.label,
        fieldType: dto.fieldType,
        selectOptions: dto.selectOptions ?? [],
        required: dto.required ?? false,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  upsert(tenantId: string, dto: CreateCustomFieldDefinitionDto) {
    if (dto.fieldType === 'SELECT' && (!dto.selectOptions || dto.selectOptions.length === 0)) {
      throw new BadRequestException('SELECT fields require at least one option');
    }

    const fields = {
      label: dto.label,
      fieldType: dto.fieldType,
      selectOptions: dto.selectOptions ?? [],
      required: dto.required ?? false,
      displayOrder: dto.displayOrder ?? 0,
    };

    return this.prisma.customFieldDefinition.upsert({
      where: { tenantId_entityType_fieldKey: { tenantId, entityType: dto.entityType, fieldKey: dto.fieldKey } },
      create: { tenantId, entityType: dto.entityType, fieldKey: dto.fieldKey, ...fields },
      update: fields,
    });
  }

  bulkCreate(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateCustomFieldDefinitionDto, rows, (dto) => this.upsert(tenantId, dto));
  }

  async update(tenantId: string, id: string, dto: UpdateCustomFieldDefinitionDto) {
    await this.findOne(tenantId, id);

    return this.prisma.customFieldDefinition.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOne(tenantId, id);
    await this.prisma.customFieldDefinition.delete({ where: { id } });
  }

  /** Validates a record's customFields blob against the tenant's definitions for that entity type. */
  async assertValid(
    tenantId: string,
    entityType: CustomFieldEntityType,
    values: Record<string, unknown> | undefined,
  ): Promise<void> {
    const definitions = await this.prisma.customFieldDefinition.findMany({ where: { tenantId, entityType } });
    validateCustomFieldValues(definitions, values);
  }
}
