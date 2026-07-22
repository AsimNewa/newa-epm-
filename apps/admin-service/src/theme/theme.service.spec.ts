import { Test, TestingModule } from '@nestjs/testing';
import { ThemeService } from './theme.service';
import { PrismaService } from '../prisma/prisma.service';

type DelegateMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

describe('ThemeService', () => {
  let service: ThemeService;
  let themeSetting: DelegateMock;

  beforeEach(async () => {
    themeSetting = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ThemeService, { provide: PrismaService, useValue: { themeSetting } }],
    }).compile();

    service = module.get(ThemeService);
  });

  it('get returns the existing theme when present', async () => {
    themeSetting.findUnique.mockResolvedValue({ tenantId: 'tenant-1', presetName: 'newa-dark' });

    const result = await service.get('tenant-1');

    expect(themeSetting.create).not.toHaveBeenCalled();
    expect(result).toEqual({ tenantId: 'tenant-1', presetName: 'newa-dark' });
  });

  it('get creates a default theme when none exists', async () => {
    themeSetting.findUnique.mockResolvedValue(null);
    themeSetting.create.mockResolvedValue({ tenantId: 'tenant-1', presetName: 'newa-dark' });

    const result = await service.get('tenant-1');

    expect(themeSetting.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1' } });
    expect(result).toEqual({ tenantId: 'tenant-1', presetName: 'newa-dark' });
  });

  it('update ensures a row exists then applies the patch', async () => {
    themeSetting.findUnique.mockResolvedValue({ tenantId: 'tenant-1' });
    themeSetting.update.mockResolvedValue({ tenantId: 'tenant-1', primaryColor: '#000000' });

    const result = await service.update('tenant-1', { primaryColor: '#000000' });

    expect(themeSetting.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { primaryColor: '#000000' },
    });
    expect(result).toEqual({ tenantId: 'tenant-1', primaryColor: '#000000' });
  });
});
