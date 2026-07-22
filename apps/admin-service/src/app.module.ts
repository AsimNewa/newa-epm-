import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { EntitiesModule } from './master-data/entities/entities.module';
import { ChartOfAccountsModule } from './master-data/chart-of-accounts/chart-of-accounts.module';
import { CurrenciesModule } from './master-data/currencies/currencies.module';
import { DimensionsModule } from './master-data/dimensions/dimensions.module';
import { DimensionAccountRulesModule } from './master-data/dimension-account-rules/dimension-account-rules.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { OwnershipModule } from './ownership/ownership.module';
import { PeriodsModule } from './periods/periods.module';
import { ThemeModule } from './theme/theme.module';
import { SettingsModule } from './settings/settings.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { FieldGroupingModule } from './field-grouping/field-grouping.module';
import { RateTypesModule } from './master-data/rate-types/rate-types.module';

@Module({
  imports: [
    PrismaModule,
    EntitiesModule,
    ChartOfAccountsModule,
    CurrenciesModule,
    RateTypesModule,
    DimensionsModule,
    DimensionAccountRulesModule,
    UsersModule,
    RolesModule,
    OwnershipModule,
    PeriodsModule,
    ThemeModule,
    SettingsModule,
    CustomFieldsModule,
    FieldGroupingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
