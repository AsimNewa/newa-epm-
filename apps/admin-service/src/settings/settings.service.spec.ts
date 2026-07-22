import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

type DelegateMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

describe('SettingsService', () => {
  let service: SettingsService;
  let tenantSettings: DelegateMock;

  beforeEach(async () => {
    tenantSettings = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService, { provide: PrismaService, useValue: { tenantSettings } }],
    }).compile();

    service = module.get(SettingsService);
  });

  it('get creates default settings when none exist and never exposes a null password as set', async () => {
    tenantSettings.findUnique.mockResolvedValue(null);
    tenantSettings.create.mockResolvedValue({ tenantId: 'tenant-1', smtpPassword: null, passwordMinLength: 12 });

    const result = await service.get('tenant-1');

    expect(tenantSettings.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1' } });
    expect(result).toEqual({ tenantId: 'tenant-1', passwordMinLength: 12, smtpPasswordSet: false });
    expect(result).not.toHaveProperty('smtpPassword');
  });

  it('get reports smtpPasswordSet true when a password is stored, without returning it', async () => {
    tenantSettings.findUnique.mockResolvedValue({ tenantId: 'tenant-1', smtpPassword: 'super-secret' });

    const result = await service.get('tenant-1');

    expect(result.smtpPasswordSet).toBe(true);
    expect(result).not.toHaveProperty('smtpPassword');
  });

  it('update writes a new smtp password when provided', async () => {
    tenantSettings.findUnique.mockResolvedValue({ tenantId: 'tenant-1', smtpPassword: null });
    tenantSettings.update.mockResolvedValue({ tenantId: 'tenant-1', smtpPassword: 'new-secret', smtpHost: 'smtp.test' });

    await service.update('tenant-1', { smtpHost: 'smtp.test', smtpPassword: 'new-secret' });

    expect(tenantSettings.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { smtpHost: 'smtp.test', smtpPassword: 'new-secret' },
    });
  });

  it('update leaves the stored smtp password unchanged when omitted', async () => {
    tenantSettings.findUnique.mockResolvedValue({ tenantId: 'tenant-1', smtpPassword: 'existing-secret' });
    tenantSettings.update.mockResolvedValue({ tenantId: 'tenant-1', smtpPassword: 'existing-secret', smtpHost: 'smtp.test' });

    await service.update('tenant-1', { smtpHost: 'smtp.test' });

    expect(tenantSettings.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { smtpHost: 'smtp.test' },
    });
  });
});
