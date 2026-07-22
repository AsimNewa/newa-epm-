import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomFieldsService } from '../../custom-fields/custom-fields.service';

type DelegateMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('CurrenciesService', () => {
  let service: CurrenciesService;
  let currency: DelegateMock;
  let exchangeRate: DelegateMock;
  let customFields: { assertValid: jest.Mock };

  beforeEach(async () => {
    currency = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    exchangeRate = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    customFields = { assertValid: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrenciesService,
        { provide: PrismaService, useValue: { currency, exchangeRate } },
        { provide: CustomFieldsService, useValue: customFields },
      ],
    }).compile();

    service = module.get(CurrenciesService);
  });

  describe('currencies', () => {
    it('findAll scopes the query by tenant', async () => {
      currency.findMany.mockResolvedValue([{ id: 'c1' }]);

      const result = await service.findAll('tenant-1');

      expect(currency.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' }, orderBy: { code: 'asc' } });
      expect(result).toEqual([{ id: 'c1' }]);
    });

    it('findOne throws NotFoundException when missing', async () => {
      currency.findFirst.mockResolvedValue(null);

      await expect(service.findOne('tenant-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('create scopes the currency to the tenant', async () => {
      currency.create.mockResolvedValue({ id: 'c1' });

      await service.create('tenant-1', { code: 'USD', name: 'US Dollar' });

      expect(currency.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', code: 'USD', name: 'US Dollar' },
      });
    });

    it('remove deletes the currency after verifying it exists', async () => {
      currency.findFirst.mockResolvedValue({ id: 'c1' });

      await service.remove('tenant-1', 'c1');

      expect(currency.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });

  describe('exchange rates', () => {
    it('findAllExchangeRates scopes the query by tenant and orders by date desc', async () => {
      exchangeRate.findMany.mockResolvedValue([{ id: 'r1' }]);

      const result = await service.findAllExchangeRates('tenant-1');

      expect(exchangeRate.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { rateDate: 'desc' },
      });
      expect(result).toEqual([{ id: 'r1' }]);
    });

    it('createExchangeRate defaults rateType to SPOT and parses the date', async () => {
      exchangeRate.create.mockResolvedValue({ id: 'r1' });

      await service.createExchangeRate('tenant-1', {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rateDate: '2026-01-01',
        rate: 0.92,
      });

      expect(exchangeRate.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          fromCurrency: 'USD',
          toCurrency: 'EUR',
          rateDate: new Date('2026-01-01'),
          rate: 0.92,
          rateType: 'SPOT',
        },
      });
    });

    it('createExchangeRate honors an explicit rateType', async () => {
      exchangeRate.create.mockResolvedValue({ id: 'r1' });

      await service.createExchangeRate('tenant-1', {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rateDate: '2026-01-01',
        rate: 0.92,
        rateType: 'CLOSING',
      });

      expect(exchangeRate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rateType: 'CLOSING' }) }),
      );
    });

    it('updateExchangeRate throws NotFoundException when missing', async () => {
      exchangeRate.findFirst.mockResolvedValue(null);

      await expect(service.updateExchangeRate('tenant-1', 'missing', { rate: 1 })).rejects.toThrow(
        NotFoundException,
      );
      expect(exchangeRate.update).not.toHaveBeenCalled();
    });

    it('removeExchangeRate deletes after verifying it exists', async () => {
      exchangeRate.findFirst.mockResolvedValue({ id: 'r1' });

      await service.removeExchangeRate('tenant-1', 'r1');

      expect(exchangeRate.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });
});
