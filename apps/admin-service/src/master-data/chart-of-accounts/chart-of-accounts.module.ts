import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../../custom-fields/custom-fields.module';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { ChartOfAccountsService } from './chart-of-accounts.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [ChartOfAccountsController],
  providers: [ChartOfAccountsService],
})
export class ChartOfAccountsModule {}
