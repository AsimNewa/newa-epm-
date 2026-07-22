import { Injectable } from '@nestjs/common';
import { UpdateThemeDto } from '@newa-epm/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ThemeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const existing = await this.prisma.themeSetting.findUnique({ where: { tenantId } });

    if (existing) {
      return existing;
    }

    return this.prisma.themeSetting.create({ data: { tenantId } });
  }

  async update(tenantId: string, dto: UpdateThemeDto) {
    await this.get(tenantId);

    return this.prisma.themeSetting.update({ where: { tenantId }, data: dto });
  }
}
