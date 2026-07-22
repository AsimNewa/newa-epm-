import { Injectable } from '@nestjs/common';
import { UpdateTenantSettingsDto } from '@newa-epm/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TenantSettingsRow = Prisma.TenantSettingsGetPayload<Record<string, never>>;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Never expose the raw SMTP password; callers only learn whether one has been configured. */
  private toResponse(settings: TenantSettingsRow) {
    const { smtpPassword, ...rest } = settings;
    return { ...rest, smtpPasswordSet: !!smtpPassword };
  }

  async get(tenantId: string) {
    const existing = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });

    if (existing) {
      return this.toResponse(existing);
    }

    const created = await this.prisma.tenantSettings.create({ data: { tenantId } });
    return this.toResponse(created);
  }

  async update(tenantId: string, dto: UpdateTenantSettingsDto) {
    await this.get(tenantId);

    const { smtpPassword, ...rest } = dto;
    const data: Prisma.TenantSettingsUpdateInput = { ...rest };

    // Omitting/blanking smtpPassword leaves the previously stored credential unchanged.
    if (smtpPassword) {
      data.smtpPassword = smtpPassword;
    }

    const updated = await this.prisma.tenantSettings.update({ where: { tenantId }, data });
    return this.toResponse(updated);
  }
}
