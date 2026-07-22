import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateCurrencyDto,
  CreateExchangeRateDto,
  ImportResult,
  UpdateCurrencyDto,
  UpdateExchangeRateDto,
} from '@newa-epm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';
import { bulkImport } from '../../common/bulk-import.util';

@Injectable()
export class CurrenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customFields: CustomFieldsService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.currency.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const currency = await this.prisma.currency.findFirst({ where: { id, tenantId } });

    if (!currency) {
      throw new NotFoundException(`Currency ${id} not found`);
    }

    return currency;
  }

  async create(tenantId: string, dto: CreateCurrencyDto) {
    await this.customFields.assertValid(tenantId, 'CURRENCY', dto.customFields);

    return this.prisma.currency.create({
      data: { tenantId, code: dto.code, name: dto.name, customFields: dto.customFields as Prisma.InputJsonValue | undefined },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCurrencyDto) {
    await this.findOne(tenantId, id);

    if (dto.customFields) {
      await this.customFields.assertValid(tenantId, 'CURRENCY', dto.customFields);
    }

    return this.prisma.currency.update({
      where: { id },
      data: dto as Prisma.CurrencyUncheckedUpdateInput,
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOne(tenantId, id);
    await this.prisma.currency.delete({ where: { id } });
  }

  async upsert(tenantId: string, dto: CreateCurrencyDto) {
    await this.customFields.assertValid(tenantId, 'CURRENCY', dto.customFields);

    return this.prisma.currency.upsert({
      where: { tenantId_code: { tenantId, code: dto.code } },
      create: { tenantId, code: dto.code, name: dto.name, customFields: dto.customFields as Prisma.InputJsonValue | undefined },
      update: { name: dto.name, customFields: dto.customFields as Prisma.InputJsonValue | undefined },
    });
  }

  bulkCreate(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateCurrencyDto, rows, (dto) => this.upsert(tenantId, dto));
  }

  findAllExchangeRates(tenantId: string) {
    return this.prisma.exchangeRate.findMany({
      where: { tenantId },
      orderBy: { rateDate: 'desc' },
    });
  }

  async findOneExchangeRate(tenantId: string, id: string) {
    const rate = await this.prisma.exchangeRate.findFirst({ where: { id, tenantId } });

    if (!rate) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }

    return rate;
  }

  createExchangeRate(tenantId: string, dto: CreateExchangeRateDto) {
    return this.prisma.exchangeRate.create({
      data: {
        tenantId,
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        rateDate: new Date(dto.rateDate),
        rate: dto.rate,
        rateType: dto.rateType ?? 'SPOT',
      },
    });
  }

  async updateExchangeRate(tenantId: string, id: string, dto: UpdateExchangeRateDto) {
    await this.findOneExchangeRate(tenantId, id);

    return this.prisma.exchangeRate.update({
      where: { id },
      data: { rate: dto.rate },
    });
  }

  async removeExchangeRate(tenantId: string, id: string): Promise<void> {
    await this.findOneExchangeRate(tenantId, id);
    await this.prisma.exchangeRate.delete({ where: { id } });
  }

  async upsertExchangeRate(tenantId: string, dto: CreateExchangeRateDto) {
    const rateDate = new Date(dto.rateDate);
    const rateType = dto.rateType ?? 'SPOT';
    return this.prisma.exchangeRate.upsert({
      where: { tenantId_fromCurrency_toCurrency_rateDate_rateType: { tenantId, fromCurrency: dto.fromCurrency, toCurrency: dto.toCurrency, rateDate, rateType } },
      create: { tenantId, fromCurrency: dto.fromCurrency, toCurrency: dto.toCurrency, rateDate, rate: dto.rate, rateType },
      update: { rate: dto.rate },
    });
  }

  bulkCreateExchangeRates(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    return bulkImport(CreateExchangeRateDto, rows, (dto) => this.upsertExchangeRate(tenantId, dto));
  }
}
